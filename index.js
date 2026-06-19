require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, AttachmentBuilder, ButtonStyle, ActivityType, REST, Routes } = require('discord.js');
const { createCanvas, loadImage } = require('skia-canvas');
const { joinVoiceChannel } = require('@discordjs/voice');
const express = require('express');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const app = express();
const port = process.env.PORT || 3000;

const config = {
    matchingRoomId: "1516548178382688408",
    profileRoomId: "1501583456872829068",
    autoJoinRoomId: "123456789012345678",
    colorRoomId: "1515250871313408142",
    panelImage: "https://cdn.discordapp.com/attachments/1035223472898584727/15155559849436516382/panel.png"
};

const activeGames = { roulette: new Map(), mafia: new Map() };
const imageCache = new Map();

async function drawProfile(bannerUrl, avatarUrl) {
    const canvas = createCanvas(800, 480);
    const ctx = canvas.getContext('2d');
    const banner = await loadImage(bannerUrl);
    ctx.drawImage(banner, 0, 0, 800, 200);
    const avatar = await loadImage(avatarUrl);
    ctx.beginPath();
    ctx.arc(100, 250, 60, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(avatar, 40, 190, 120, 120);
    return canvas.toBuffer('png');
}

async function drawMatching(bannerUrl, av1Url, av2Url) {
    const canvas = createCanvas(800, 500);
    const ctx = canvas.getContext('2d');
    const banner = await loadImage(bannerUrl);
    ctx.drawImage(banner, 50, 50, 700, 250);
    async function drawCircle(url, x, y) {
        const img = await loadImage(url);
        ctx.save();
        ctx.beginPath();
        ctx.arc(x + 75, y + 75, 75, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(img, x, y, 150, 150);
        ctx.restore();
    }
    await drawCircle(av1Url, 150, 320);
    await drawCircle(av2Url, 500, 320);
    return canvas.toBuffer('png');
}

async function drawRouletteResult(players) {
    const canvas = createCanvas(800, 400);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2b2d31'; ctx.fillRect(0, 0, 800, 400);
    for (let i = 0; i < players.length; i++) {
        const u = await client.users.fetch(players[i]);
        const img = await loadImage(u.displayAvatarURL({ extension: 'png' }));
        ctx.save(); ctx.beginPath(); ctx.arc(100 + (i * 150), 150, 60, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, 40 + (i * 150), 90, 120, 120); ctx.restore();
        ctx.fillStyle = '#fff'; ctx.fillText(u.username, 100 + (i * 150), 250);
    }
    return canvas.toBuffer('png');
}

client.once('ready', async () => {
    console.log(`تم تشغيل البوت: ${client.user.tag}`);
    client.user.setActivity('JOJO’s System', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' });
    const commands = [
        { name: 'panel', description: 'عرض لوحة التحكم' },
        { name: 'roulette', description: 'بدء لعبة الروليت' },
        { name: 'mafia', description: 'بدء لعبة المافيا' },
        { name: 'matching', description: 'تصميم الماتشينق', options: [{ name: 'banner', type: 11, description: 'البنر', required: true }, { name: 'avatar1', type: 11, description: 'الأفاتار 1', required: true }, { name: 'avatar2', type: 11, description: 'الأفاتار 2', required: true }] },
        { name: 'افتار', description: 'تصميم الأفتار', options: [{ name: 'banner', type: 11, description: 'البنر', required: true }, { name: 'avatar1', type: 11, description: 'الأفاتار', required: true }] }
    ];
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); console.log('✅ تم تسجيل الأوامر!'); } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, guildId } = interaction;
        if (commandName === 'افتار' || commandName === 'matching') {
            const isMatching = commandName === 'matching';
            const banner = interaction.options.getAttachment('banner');
            const av1 = interaction.options.getAttachment('avatar1');
            const av2 = isMatching ? interaction.options.getAttachment('avatar2') : null;
            const channelId = isMatching ? config.matchingRoomId : config.profileRoomId;
            const buffer = isMatching ? await drawMatching(banner.url, av1.url, av2.url) : await drawProfile(banner.url, av1.url);
            const attachment = new AttachmentBuilder(buffer, { name: 'card.png' });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('try_btn').setLabel('Try').setStyle(ButtonStyle.Primary));
            const channel = client.channels.cache.get(channelId);
            const sentMsg = await channel.send({ files: [attachment], components: [row] });
            imageCache.set(sentMsg.id, { banner: banner.url, av1: av1.url, av2: av2?.url });
            return interaction.reply({ content: 'تم الإرسال!', ephemeral: true });
        }
        if (commandName === 'panel') {
            const panelEmbed = new EmbedBuilder().setColor('#2b2d31').setDescription("JOJO'S control panel").setImage(config.panelImage);
            await interaction.reply({ embeds: [panelEmbed] });
        }
        if (commandName === 'roulette') { activeGames.roulette.set(guildId, { players: new Set([interaction.user.id]) }); const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_roulette').setLabel('دخول').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('start_roulette').setLabel('تدوير').setStyle(ButtonStyle.Success)); await interaction.reply({ content: `🎡 روليت: ${interaction.user}`, components: [row] }); }
        if (commandName === 'mafia') { activeGames.mafia.set(guildId, { players: new Set([interaction.user.id]) }); const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_mafia').setLabel('انضمام').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('start_mafia').setLabel('توزيع الأدوار').setStyle(ButtonStyle.Danger)); await interaction.reply({ content: `🕵️‍♂️ مافيا: ${interaction.user}`, components: [row] }); }
    }
});

app.get('/', (req, res) => res.send('البوت يعمل!'));
app.listen(port, () => console.log(`السيرفر يعمل على ${port}`));
client.login(process.env.TOKEN);
