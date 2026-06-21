require('dotenv').config();
const { Client, GatewayIntentBits, ActivityType, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const TARGET_CHANNEL_ID = '1501583456872829068';
const ROLE_ID = '1501374221992071348';

client.once('ready', () => {
    console.log(`✅ البوت متصل!`);
    client.user.setPresence({
        activities: [{ name: 'Watching .e_9', type: ActivityType.Streaming, url: 'https://www.twitch.tv/fajer' }],
        status: 'online'
    });
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith('!profile')) return;
    if (!message.member.roles.cache.has(ROLE_ID)) return;

    await message.reply('أرسل البنر أولاً، ثم الأفاتار:');
    const collector = message.channel.createMessageCollector({ filter: m => m.author.id === message.author.id && m.attachments.size > 0, max: 2, time: 60000 });

    let images = [];
    collector.on('collect', m => { images.push(m.attachments.first().url); });

    collector.on('end', async () => {
        if (images.length < 2) return;
        try {
            // رسم التصميم الاحترافي (مطابق لـ custom_profile_2.png)
            const canvas = createCanvas(1000, 600);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, 1000, 600);
            const banner = await loadImage(images[0]);
            ctx.drawImage(banner, 0, 0, 1000, 300);
            const avatar = await loadImage(images[1]);
            ctx.save(); ctx.beginPath(); ctx.arc(150, 400, 90, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(avatar, 60, 310, 180, 180); ctx.restore();
            ctx.fillStyle = "#ffffff"; ctx.font = "bold 40px Arial"; ctx.fillText(message.author.username, 270, 400);

            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'profile.png' });
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('try_btn').setLabel('Try').setEmoji('1513336672870469793').setStyle(ButtonStyle.Primary)
            );

            const channel = client.channels.cache.get(TARGET_CHANNEL_ID);
            const msg = await channel.send({ files: [attachment], components: [row] });

            // نظام الزر: عند الضغط يرسل الصور الأصلية
            const collectorBtn = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 300000 });
            collectorBtn.on('collect', async i => {
                await i.reply({ content: `الصور الأصلية:\nالبنر: ${images[0]}\nالأفاتار: ${images[1]}`, ephemeral: true });
            });
        } catch (e) { message.channel.send('❌ حدث خطأ في الرسم.'); }
    });
});

client.login(process.env.TOKEN);
