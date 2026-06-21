require('dotenv').config();
const { 
    Client, 
    GatewayIntentBits, 
    AttachmentBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActivityType, 
    Events, 
    ChannelType, 
    PermissionsBitField 
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const express = require('express');

// إعداد خادم Express للحفاظ على عمل البوت 24/7
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Bot is active and running!'));
app.listen(port, () => console.log(`🚀 Web server running on port ${port}`));

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers
    ] 
});

const TARGET_CHANNEL_ID = '1501583456872829068';
const EMOJI_ID = '1513336672870469793';
const ROLE_ID = '1501374221992071348';
const designCache = new Map();

client.once('ready', () => {
    client.user.setPresence({
        activities: [{ name: 'JOJO’s Designs', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }],
        status: 'online'
    });
    console.log(`✅ البوت متصل الآن!`);
});

// دالة القص الذكي لمنع التمطيط
async function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sWidth, sHeight, sx, sy;
    if (imgRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sHeight = img.height;
        sx = (img.width - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = img.width;
        sHeight = img.width / targetRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

// دالة إنشاء الكارد (اللوحة)
async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(800, 450);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 800, 450);
    
    const banner = await loadImage(bannerUrl);
    await drawImageCover(ctx, banner, 0, 0, 800, 250);
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 250, 75, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    await drawImageCover(ctx, avatar, 55, 175, 150, 150);
    ctx.restore();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px "Times New Roman", serif';
    ctx.fillText(member.user.username, 230, 275);
    
    ctx.fillStyle = '#888888';
    ctx.font = '16px sans-serif';
    ctx.fillText('@' + member.user.username.toLowerCase(), 230, 305);
    
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 360);
    ctx.lineTo(750, 360);
    ctx.stroke();
    
    ctx.fillStyle = '#777777';
    ctx.font = 'bold 16px "Times New Roman", serif';
    ctx.fillText('MEMBER SINCE', 50, 390);
    ctx.fillText('JOINED SERVER', 420, 390);
    
    ctx.fillStyle = '#ffffff';
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 50, 415);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 420, 415);
    
    return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });
}

// دالة إنشاء قناة صوتية خاصة للمستخدم
async function createPrivateVoiceChannel(guild, member) {
    return await guild.channels.create({
        name: `Design-${member.user.username}`,
        type: ChannelType.GuildVoice,
        permissionOverwrites: [
            {
                id: guild.id, // منع الجميع من الدخول
                deny: [PermissionsBitField.Flags.Connect],
            },
            {
                id: member.id, // السماح للمستخدم صاحب الطلب
                allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: client.user.id, // صلاحية للبوت للتحكم
                allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ManageChannels],
            }
        ],
    });
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design')) return;
    if (!message.member.roles.cache.has(ROLE_ID)) return;
    if (message.attachments.size < 2) return;
    
    const att = Array.from(message.attachments.values());
    const data = { bannerUrl: att[0].url, avatarUrl: att[1].url };
    designCache.set(message.author.id, data);
    
    // إنشاء القناة الصوتية الخاصة
    const vc = await createPrivateVoiceChannel(message.guild, message.member);
    
    const card = await createProfileCard(data.bannerUrl, data.avatarUrl, message.member);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('try_btn').setLabel('Try').setEmoji(EMOJI_ID).setStyle(ButtonStyle.Secondary)
    );

    const channel = client.channels.cache.get(TARGET_CHANNEL_ID);
    await channel.send({ 
        content: `تم تصميم بطاقتك بنجاح! تم فتح غرفتك الصوتية الخاصة: <#${vc.id}>`, 
        files: [card], 
        components: [row] 
    });
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'try_btn') return;
    const data = designCache.get(interaction.user.id);
    if (!data) return interaction.reply({ content: '❌ لا توجد بيانات محفوظة.', ephemeral: true });
    
    await interaction.reply({ 
        content: 'تفضل، هذه هي الصور الأصلية التي أرفقتها:', 
        files: [data.bannerUrl, data.avatarUrl], 
        ephemeral: true 
    });
});

client.login(process.env.TOKEN);
