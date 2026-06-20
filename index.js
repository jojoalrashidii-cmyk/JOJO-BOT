require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, AttachmentBuilder, ActivityType } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const express = require('express');

// إعداد خادم Express لضمان بقاء البوت نشطاً
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('البوت يعمل بكفاءة!'));
app.listen(port, () => console.log(`🚀 خادم Express يعمل على المنفذ ${port}`));

const config = {
    profileRoomId: "1501583456872829068",
    adminRoleId: "1501374221992071348"
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// دالة رسم البروفايل الاحترافي
async function drawProfile(bannerUrl, avatarUrl, username) {
    const canvas = createCanvas(800, 480);
    const ctx = canvas.getContext('2d');
    
    // خلفية نظيفة
    ctx.fillStyle = '#1e1f22'; 
    ctx.fillRect(0, 0, 800, 480);
    
    const [banner, avatar] = await Promise.all([loadImage(bannerUrl), loadImage(avatarUrl)]);
    ctx.drawImage(banner, 0, 0, 800, 200);
    
    // رسم الأفاتار
    ctx.save(); 
    ctx.beginPath(); 
    ctx.arc(100, 250, 60, 0, Math.PI * 2); 
    ctx.clip();
    ctx.drawImage(avatar, 40, 190, 120, 120); 
    ctx.restore();
    
    // رسم اسم المستخدم
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px Arial';
    ctx.fillText(username, 180, 260); 
    
    ctx.fillStyle = '#b5bac1';
    ctx.font = '16px Arial';
    ctx.fillText(`@${username}`, 180, 290); 
    
    return canvas.toBuffer();
}

client.once('ready', async () => {
    // تفعيل الـ Fake Streaming
    client.user.setActivity('JOJO’s Designs', {
        type: ActivityType.Streaming,
        url: 'https://www.twitch.tv/discord'
    });

    // تسجيل الأمر
    const commands = [
        { name: 'افتار', description: 'تصميم بروفايل احترافي', options: [{ name: 'banner', type: 11, description: 'البنر', required: true }, { name: 'avatar1', type: 11, description: 'الأفاتار', required: true }] }
    ];
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ البوت يعمل وجاهز (Streaming Mode): ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    
    // التحقق من رتبة الإدارة
    if (!interaction.member.roles.cache.has(config.adminRoleId)) {
        return interaction.reply({ content: '❌ عذراً، لا تملك رتبة الإدارة.', ephemeral: true });
    }

    if (interaction.commandName === 'افتار') {
        await interaction.deferReply({ ephemeral: true });
        
        const banner = interaction.options.getAttachment('banner');
        const av1 = interaction.options.getAttachment('avatar1');
        const username = interaction.user.username;
        
        const buffer = await drawProfile(banner.url, av1.url, username);
        const channel = client.channels.cache.get(config.profileRoomId);
        
        await channel.send({ files: [new AttachmentBuilder(buffer, { name: 'profile.png' })] });
        interaction.editReply('✅ تم تصميم البروفايل وإرساله بنجاح!');
    }
});

client.login(process.env.TOKEN);
