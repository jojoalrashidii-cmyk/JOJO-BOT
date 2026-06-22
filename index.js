require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, Events, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const express = require('express');
const path = require('path');
const fs = require('fs');

// --- 1. إعداد الخط ---
const fontPath = path.join(__dirname, 'font.ttf');
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, 'MyCustomFont');
    console.log('✅ تم تحميل الخط المخصص بنجاح.');
} else {
    console.warn('⚠️ تحذير: ملف font.ttf غير موجود. سيتم استخدام الخط الافتراضي.');
}

// --- 2. إعداد الخادم (للحفاظ على استمرار البوت في رايواي) ---
const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

// --- 3. إعداد البوت ---
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates
    ] 
});

// الثوابت
const TARGET_CHANNEL_ID = '1501583456872829068';
const VOICE_CHANNEL_ID = '1518127536834613360';
const EMOJI_ID = '1513336672870469793';
const ROLE_ID = '1501374221992071348';
const MY_USER_ID = '890586243346354216'; 
const designCache = new Map();

client.once('ready', async () => {
    client.user.setPresence({
        activities: [{ name: 'JOJO’s Designs', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }],
        status: 'online'
    });
    
    console.log('✅ البوت متصل، جاري تأمين الروم...');
    
    const guild = client.guilds.cache.first();
    if (guild) {
        try {
            const myUser = await guild.members.fetch(MY_USER_ID).catch(() => null);
            const vc = guild.channels.cache.get(VOICE_CHANNEL_ID);
            
            if (vc) {
                await vc.permissionOverwrites.set([
                    { id: guild.id, deny: [PermissionsBitField.Flags.Connect], allow: [PermissionsBitField.Flags.ViewChannel] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel] },
                    ...(myUser ? [{ id: myUser.id, allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel] }] : [])
                ]);

                joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator });
                console.log('🔒 تم تأمين الروم ودخول البوت.');
            }
        } catch (err) { console.error("❌ خطأ أثناء تأمين الروم: ", err); }
    }
});

// --- 4. دالة الرسم ---
async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(800, 450);
    const ctx = canvas.getContext('2d');
    
    // خلفية داكنة
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 800, 450);
    
    // رسم البانر بملء الشاشة (بدون قص)
    const banner = await loadImage(bannerUrl);
    ctx.drawImage(banner, 0, 0, 800, 250);
    
    // دائرة الأفاتار
    ctx.save();
    ctx.beginPath();
    ctx.arc(130, 250, 75, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 55, 175, 150, 150);
    ctx.restore();
    
    // إعدادات الخط
    const font = fs.existsSync(fontPath) ? '"MyCustomFont"' : 'sans-serif';
    
    // الاسم والمعرف
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 30px ${font}`;
    ctx.fillText(member.user.username, 230, 275);
    
    ctx.fillStyle = '#888888';
    ctx.font = `18px ${font}`;
    ctx.fillText('@' + member.user.username.toLowerCase(), 230, 305);
    
    // الخط الفاصل
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 360);
    ctx.lineTo(750, 360);
    ctx.stroke();
    
    // التواريخ
    ctx.fillStyle = '#777777';
    ctx.font = `bold 14px ${font}`;
    ctx.fillText('MEMBER SINCE', 50, 390);
    ctx.fillText('JOINED SERVER', 420, 390);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `16px ${font}`;
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 50, 415);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 420, 415);
    
    return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });
}

// --- 5. التعامل مع الأوامر ---
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design')) return;
    
    if (!message.member.roles.cache.has(ROLE_ID)) {
        return message.reply('❌ ليس لديك الصلاحية لاستخدام هذا الأمر.');
    }
    
    if (message.attachments.size < 2) {
        return message.reply('⚠️ يرجى إرفاق صورتين (الأولى للبانر، الثانية للأفاتار).');
    }
    
    const att = Array.from(message.attachments.values());
    const data = { bannerUrl: att[0].url, avatarUrl: att[1].url };
    designCache.set(message.author.id, data);
    
    try {
        const card = await createProfileCard(data.bannerUrl, data.avatarUrl, message.member);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('try_btn').setLabel('Try').setEmoji(EMOJI_ID).setStyle(ButtonStyle.Secondary)
        );
        await message.channel.send({ files: [card], components: [row] });
    } catch (err) {
        console.error("❌ خطأ في إنشاء الكارد: ", err);
        message.reply('❌ حدث خطأ أثناء معالجة الصور.');
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'try_btn') {
        const data = designCache.get(interaction.user.id);
        if (!data) return interaction.reply({ content: '❌ لا توجد بيانات.', ephemeral: true });
        await interaction.reply({ content: `الصور الأصلية:\nالبنر: ${data.bannerUrl}\nالأفاتار: ${data.avatarUrl}`, ephemeral: true });
    }
});

client.login(process.env.TOKEN);
