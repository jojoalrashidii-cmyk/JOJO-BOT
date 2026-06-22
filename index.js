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
    console.warn('⚠️ تحذير: لم يتم العثور على font.ttf، سيتم استخدام الخط الافتراضي.');
}

// --- 2. إعداد الخادم ---
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

// --- 4. دالة الرسم (معدلة للحصول على المساحات والحواف المطلوبة) ---
async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(900, 400); // حجم أكبر قليلاً لتناسب النسب
    const ctx = canvas.getContext('2d');
    
    // الخلفية الأساسية (اللون اللي يظهر في الحواف)
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 900, 400);
    
    // رسم البانر مع "هوامش" (Padding)
    const padding = 30; // الحواف المطلوبة
    const bannerW = 900 - (padding * 2);
    const bannerH = 200;
    
    const banner = await loadImage(bannerUrl);
    ctx.drawImage(banner, padding, padding, bannerW, bannerH);
    
    // رسم الأفاتار
    ctx.save();
    ctx.beginPath();
    ctx.arc(100, 270, 65, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 35, 205, 130, 130);
    ctx.restore();
    
    // الخطوط والنصوص
    const font = fs.existsSync(fontPath) ? '"MyCustomFont"' : 'sans-serif';
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 28px ${font}`;
    ctx.fillText(member.user.username, 190, 280);
    
    ctx.fillStyle = '#888888';
    ctx.font = `16px ${font}`;
    ctx.fillText('@' + member.user.username.toLowerCase(), 190, 310);
    
    // الخط الفاصل
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, 350);
    ctx.lineTo(870, 350);
    ctx.stroke();
    
    // التواريخ
    ctx.fillStyle = '#777777';
    ctx.font = `bold 12px ${font}`;
    ctx.fillText('MEMBER SINCE', padding, 380);
    ctx.fillText('JOINED SERVER', 500, 380);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = `14px ${font}`;
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US'), padding, 395);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US'), 500, 395);
    
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
