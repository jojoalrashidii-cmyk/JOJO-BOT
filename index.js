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

// هذه الدالة الموحدة ستستخدم لجميع الأوامر لضمان نفس الشكل
async function createUnifiedCard(bannerUrl, avatarUrls, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');

    // الخلفية سوداء
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1000, 600);

    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 40, 40, 920, 300); 

    const AVATAR_SIZE = 180;
    const Y_AVATARS = 330; 
    const START_X = 60;
    
    async function drawAvatar(url, x, y, size) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#000000';
        ctx.fill();
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#000000';
        ctx.stroke();
        ctx.clip();
        const img = await loadImage(url);
        ctx.drawImage(img, x, y, size, size);
        ctx.restore();
    }

    // 1. رسم الأفاتار الأول (الرئيسي)
    await drawAvatar(avatarUrls[0], START_X, Y_AVATARS, AVATAR_SIZE);

    // 2. رسم النص (الاسم واليوزر) بجانب الأفاتار الأول
    const textStartX = START_X + AVATAR_SIZE + 20;
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 40px "${FONT_NAME}"`;
    ctx.fillText(member.user.username, textStartX, 380);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `20px "${FONT_NAME}"`;
    ctx.fillText('@' + member.user.username.toLowerCase(), textStartX, 410);

    // 3. رسم بقية الأفاتارات: تم ضبط الإحداثيات والمسافات لضمان التنسيق الصحيح
    // نبدأ من بعد النص مباشرة مع إضافة هامش بسيط
    let currentX = textStartX + 100; 
    const spacing = 20; // المسافة بين الأفاتارات الإضافية

    for (let i = 1; i < avatarUrls.length; i++) {
        // إذا كان الأفاتار سيتجاوز حدود الـ 950، نتوقف أو نعدل الموقع (هنا التنسيق متوافق مع 4 أفاتارات)
        if (currentX + AVATAR_SIZE > 980) break;
        
        await drawAvatar(avatarUrls[i], currentX, Y_AVATARS, AVATAR_SIZE);
        currentX += (AVATAR_SIZE + spacing);
    }

    ctx.fillStyle = '#777777';
    ctx.font = `bold 14px "${FONT_NAME}"`;
    ctx.fillText('MEMBER SINCE', START_X, 550);
    ctx.fillText('JOINED SERVER', START_X + 250, 550);

    ctx.fillStyle = '#ffffff';
    ctx.font = `20px "${FONT_NAME}"`;
    const memberSince = member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
    const joinedServer = member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'});
    
    ctx.fillText(memberSince, START_X, 580);
    ctx.fillText(joinedServer, START_X + 250, 580);

    return canvas;
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.member?.roles.cache.has(ROLE_ID) || isProcessing.has(message.author.id))
        return;

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

        const canvas = await createUnifiedCard(bannerUrl, avatarUrls, message.member);
            
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
    
    // نقوم بجلب الرسالة التي ضغط المستخدم على زرها
    const message = await interaction.message.fetch();
    
    // نستخرج الروابط من المرفقات (Attachments) الموجودة في الرسالة الأصلية
    // ملاحظة: الأفاتار هو المرفق الثاني والثالث.. والبنر هو الأول
    const attachments = Array.from(message.attachments.values());
    if (attachments.length < 2) return interaction.reply({ content: '❌ لا توجد صور مرتبطة بهذه الرسالة.', ephemeral: true });

    // البنر هو المرفق الأول، البقية هم الأفاتارات
    const bannerUrl = attachments[0].url;
    const avatarUrls = attachments.slice(1).map(att => att.url);

    const files = [bannerUrl, ...avatarUrls].map((url, index) => 
        new AttachmentBuilder(url, { name: `image${index}.png` })
    );

    if (interaction.customId === 'try_design') {
        await interaction.reply({ 
            content: 'خذ خذ وتوكل:', 
            files: files, 
            ephemeral: true 
        });
    } else if (interaction.customId === 'send_dm') {
        try {
            await interaction.user.send({ 
                content: 'خذ خذ بس وفارق:', 
                files: files 
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
