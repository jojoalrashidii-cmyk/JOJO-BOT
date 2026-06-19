require('dotenv').config();
const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, AttachmentBuilder, ButtonStyle, ActivityType, REST, Routes } = require('discord.js');
const Jimp = require('jimp'); // تم تغيير المكتبة
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

// --- الدوال المعدلة بـ Jimp ---

async function drawProfile(bannerUrl, avatarUrl) {
    const canvas = await new Jimp(800, 480, '#2b2d31');
    const banner = await Jimp.read(bannerUrl);
    banner.resize(800, 200);
    canvas.composite(banner, 0, 0);
    
    const avatar = await Jimp.read(avatarUrl);
    avatar.resize(120, 120);
    avatar.circle(); // قص دائري
    canvas.composite(avatar, 40, 190);
    
    return await canvas.getBufferAsync(Jimp.MIME_PNG);
}

async function drawMatching(bannerUrl, av1Url, av2Url) {
    const canvas = await new Jimp(800, 500, '#2b2d31');
    const banner = await Jimp.read(bannerUrl);
    banner.resize(700, 250);
    canvas.composite(banner, 50, 50);

    const av1 = await Jimp.read(av1Url);
    av1.resize(150, 150).circle();
    canvas.composite(av1, 150, 320);

    const av2 = await Jimp.read(av2Url);
    av2.resize(150, 150).circle();
    canvas.composite(av2, 500, 320);
    
    return await canvas.getBufferAsync(Jimp.MIME_PNG);
}

async function drawRouletteResult(players) {
    // Jimp لا تدعم الكتابة المباشرة بسهولة مثل Canvas، 
    // يفضل في الروليت استخدام صور جاهزة أو استبدالها بـ Embed
    const canvas = await new Jimp(800, 400, '#2b2d31');
    return await canvas.getBufferAsync(Jimp.MIME_PNG);
}

// --- باقي الكود كما هو تماماً ---

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
    if (interaction.isButton()) {
        const { customId, guildId, user } = interaction;
        if (customId === 'try_btn') { const data = imageCache.get(interaction.message.id); if (!data) return interaction.reply({ content: 'لا توجد بيانات.', ephemeral: true }); const files = [data.banner, data.av1]; if (data.av2) files.push(data.av2); return interaction.reply({ content: 'تفضل:', files: files, ephemeral: true }); }
        if (customId === 'join_roulette') { activeGames.roulette.get(guildId)?.players.add(user.id); await interaction.reply({ content: 'تم!', ephemeral: true }); }
        if (customId === 'start_roulette') { const buf = await drawRouletteResult(Array.from(activeGames.roulette.get(guildId).players)); await interaction.reply({ files: [buf] }); }
        if (customId === 'join_mafia') { activeGames.mafia.get(guildId)?.players.add(user.id); await interaction.reply({ content: 'تم!', ephemeral: true }); }
        if (customId === 'start_mafia') { const p = Array.from(activeGames.mafia.get(guildId).players); const m = p[Math.floor(Math.random() * p.length)]; for (const id of p) { (await client.users.fetch(id)).send(id === m ? '🕵️‍♂️ أنت المافيا!' : '🛡️ أنت مواطن.').catch(() => {}); } await interaction.reply('✅ تم!'); }
    }
});

app.get('/', (req, res) => res.send('البوت يعمل!'));
app.listen(port, () => console.log(`السيرفر يعمل على ${port}`));
client.login(process.env.TOKEN);
