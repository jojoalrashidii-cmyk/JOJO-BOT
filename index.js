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

// الرومات المطلوبة
const DESIGN_CHANNEL_ID = '1501583456872829068';
const MATCHING_CHANNEL_ID = '1518670780911583283';
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

async function createMatchingCard(bannerUrl, avatarUrls, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);

    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 40, 40, 920, 300); 

    // --- إحداثيات ثابتة ومضبوطة ---
    const MAIN_AVATAR_SIZE = 200; 
    const SMALL_AVATAR_SIZE = 120;
    const Y_MAIN = 350;
    const Y_SMALL = 390;
    const START_X = 60;
    const SPACING = 20;
    
    // 1. رسم الأفاتار الأول (كبير على اليسار)
    ctx.save();
    ctx.beginPath();
    ctx.arc(START_X + (MAIN_AVATAR_SIZE / 2), Y_MAIN + (MAIN_AVATAR_SIZE / 2), MAIN_AVATAR_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();
    const mainAvatar = await loadImage(avatarUrls[0]);
    ctx.drawImage(mainAvatar, START_X, Y_MAIN, MAIN_AVATAR_SIZE, MAIN_AVATAR_SIZE);
    ctx.restore();

    // 2. النصوص الثابتة (بجانب الأفاتار الكبير)
    const textStartX = START_X + MAIN_AVATAR_SIZE + 30;

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 45px "${FONT_NAME}"`;
    ctx.fillText(member.user.username, textStartX, 410);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `25px "${FONT_NAME}"`;
    ctx.fillText('@' + member.user.username.toLowerCase(), textStartX, 450);

    // 3. التواريخ في الأسفل
    ctx.fillStyle = '#777777';
    ctx.font = `bold 16px "${FONT_NAME}"`;
    ctx.fillText('MEMBER SINCE', textStartX, 510);
    ctx.fillText('JOINED SERVER', textStartX + 220, 510);

    ctx.fillStyle = '#ffffff';
    ctx.font = `22px "${FONT_NAME}"`;
    
    const memberSince = member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
    const joinedServer = member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
    
    ctx.fillText(memberSince, textStartX, 540);
    ctx.fillText(joinedServer, textStartX + 220, 540);

    // 4. رسم الأفاتارات الإضافية (صغيرة) بجانب بعضها
    for (let i = 1; i < avatarUrls.length; i++) {
        const x = textStartX + ((i - 1) * (SMALL_AVATAR_SIZE + SPACING)) + 200; // مسافة إضافية لترتيبها
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + (SMALL_AVATAR_SIZE / 2), Y_SMALL + (SMALL_AVATAR_SIZE / 2), SMALL_AVATAR_SIZE / 2, 0, Math.PI * 2);
        ctx.clip();
        
        const avatar = await loadImage(avatarUrls[i]);
        ctx.drawImage(avatar, x, Y_SMALL, SMALL_AVATAR_SIZE, SMALL_AVATAR_SIZE);
        ctx.restore();
    }

    return canvas;
}

async function createDesignCard(bannerUrl, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);
    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 40, 40, 920, 300);
    return canvas;
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.member?.roles.cache.has(ROLE_ID) || isProcessing.has(message.author.id)) return;

    let command = message.content.split(' ')[0];
    let count = 0;
    let targetRoom = null;

    if (command === '!design') { count = 1; targetRoom = DESIGN_CHANNEL_ID; }
    else if (command === '!Matching2') { count = 2; targetRoom = MATCHING_CHANNEL_ID; }
    else if (command === '!Matching3') { count = 3; targetRoom = MATCHING_CHANNEL_ID; }
    else if (command === '!Matching4') { count = 4; targetRoom = MATCHING_CHANNEL_ID; }
    else return;

    if (message.attachments.size < (count + 1)) return;

    isProcessing.add(message.author.id);
    const targetChannel = client.channels.cache.get(targetRoom);
    
    try {
        const bannerUrl = message.attachments.first().url;
        const avatarUrls = [];
        for(let i = 1; i <= count; i++) avatarUrls.push(message.attachments.at(i).url);

        const canvas = (command === '!design') 
            ? await createDesignCard(bannerUrl, message.member)
            : await createMatchingCard(bannerUrl, avatarUrls, message.member);
            
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
        await interaction.reply({ 
            content: 'خذ خذ وتوكل:', 
            files: [data.banner, ...data.avatars], 
            ephemeral: true 
        });
    } else if (interaction.customId === 'send_dm') {
        try {
            await interaction.user.send({ 
                content: 'خذ خذ بس وفارق:', 
                files: [data.banner, ...data.avatars] 
            });
            await interaction.reply({ content: '✅ تم الإرسال للخاص!', ephemeral: true });
        } catch (err) {
            await interaction.reply({ 
                content: 'تسوقمها؟ كيف برسل لك الافتار وانت مسكر خاصك يخوي؟', 
                ephemeral: true 
            });
        }
    }
});

client.login(process.env.TOKEN);
