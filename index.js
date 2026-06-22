require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, VoiceConnectionStatus } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const express = require('express');
const path = require('path');
const fs = require('fs');

// --- إعداد الفونت ---
const FONT_NAME = 'MyCustomFont';
const fontPath = path.join(__dirname, 'font.ttf');
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, FONT_NAME);
    console.log('✅ تم تحميل الخط بنجاح');
} else {
    console.error('⚠️ خطأ: ملف font.ttf غير موجود في المجلد!');
}

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

const TARGET_CHANNEL_ID = '1518670780911583283';
const VOICE_CHANNEL_ID = '1518127536834613360';
const ROLE_ID = '1501374221992071348';
const isProcessing = new Set();
const designCache = new Map();

// --- اتصال البوت والستريم ---
client.once(Events.ClientReady, async (c) => {
    client.user.setPresence({ 
        activities: [{ name: 'JOJO’s Designs', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], 
        status: 'online' 
    });
    
    const vc = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (vc) {
        const connection = joinVoiceChannel({
            channelId: vc.id,
            guildId: vc.guild.id,
            adapterCreator: vc.guild.voiceAdapterCreator,
        });
        connection.on(VoiceConnectionStatus.Ready, () => console.log('✅ متصل بالروم الصوتي!'));
    }
});

function drawImageCover(ctx, img, x, y, width, height) {
    const ratio = Math.max(width / img.width, height / img.height);
    const sWidth = width / ratio;
    const sHeight = height / ratio;
    const sx = (img.width - sWidth) / 2;
    const sy = (img.height - sHeight) / 2;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
}

// دالة رسم الأفاتارات المتعددة بحواف دائرية
async function drawAvatars(ctx, avatarUrls, startX, y, size = 150) {
    for (let i = 0; i < avatarUrls.length; i++) {
        ctx.save();
        ctx.beginPath();
        // رسم الدائرة والحواف
        ctx.arc(startX + (i * (size + 40)) + (size / 2), y + (size / 2), size / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#0f0f0f';
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#0f0f0f';
        ctx.stroke();
        ctx.clip();
        
        const avatar = await loadImage(avatarUrls[i]);
        ctx.drawImage(avatar, startX + (i * (size + 40)), y, size, size);
        ctx.restore();
    }
}

async function createMatchingCard(bannerUrl, avatarUrls, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);

    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 40, 40, 920, 300); 
    
    // رسم الأفاتارات (نبدأ من إحداثيات ثابتة للأفاتار الأول)
    await drawAvatars(ctx, avatarUrls, 60, 300, 150);

    // النصوص
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 40px "${FONT_NAME}"`;
    ctx.fillText(member.user.username, 260, 500);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `20px "${FONT_NAME}"`;
    ctx.fillText('@' + member.user.username.toLowerCase(), 260, 540);

    return canvas;
}

client.on(Events.MessageCreate, async (message) => {
    // التحقق من البوت والرتبة
    if (message.author.bot || !message.member?.roles.cache.has(ROLE_ID) || isProcessing.has(message.author.id)) return;

    let count = 0;
    if (message.content.startsWith('!design')) count = 1;
    else if (message.content.startsWith('!Matching2')) count = 2;
    else if (message.content.startsWith('!Matching3')) count = 3;
    else if (message.content.startsWith('!Matching4')) count = 4;
    else return;

    if (message.attachments.size < (count + 1)) return;

    isProcessing.add(message.author.id);
    const targetChannel = client.channels.cache.get(TARGET_CHANNEL_ID);
    
    try {
        const bannerUrl = message.attachments.first().url;
        const avatarUrls = [];
        for(let i = 1; i <= count; i++) avatarUrls.push(message.attachments.at(i).url);

        const canvas = await createMatchingCard(bannerUrl, avatarUrls, message.member);
        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('try_design').setLabel('Try').setStyle(ButtonStyle.Secondary).setEmoji('1518609977386733678'),
            new ButtonBuilder().setCustomId('send_dm').setLabel('DM').setStyle(ButtonStyle.Secondary).setEmoji('1518609827599880253')
        );

        if (targetChannel) {
            const sentMessage = await targetChannel.send({ 
                files: [attachment],
                components: [row]
            });
            designCache.set(sentMessage.id, { banner: bannerUrl, avatars: avatarUrls });
        }
        await message.delete().catch(() => {});
    } catch (err) {
        console.error(err);
    } finally {
        isProcessing.delete(message.author.id);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    
    const data = designCache.get(interaction.message.id);
    if (!data) return interaction.reply({ content: '❌ حدث خطأ، لم أجد الصور الأصلية!', ephemeral: true });

    if (interaction.customId === 'try_design') {
        // إرسال الصور الأصلية كملفات للتجربة
        await interaction.reply({ 
            content: 'خذ خذ وتوكل:', 
            files: [data.banner, ...data.avatars], 
            ephemeral: true 
        });
    } else if (interaction.customId === 'send_dm') {
        try {
            // محاولة إرسال الصور للخاص
            await interaction.user.send({ 
                content: 'خذ خذ بس وفارق:', 
                files: [data.banner, ...data.avatars] 
            });
            await interaction.reply({ content: '✅ تم الإرسال للخاص!', ephemeral: true });
        } catch (err) {
            // في حال كان الخاص مغلقاً
            await interaction.reply({ 
                content: 'تسوقمها؟ كيف برسل لك الافتار وانت مسكر خاصك يخوي؟ بالتخاطر؟ لالا بالتخاطر', 
                ephemeral: true 
            });
        }
    }
});

client.login(process.env.TOKEN);
