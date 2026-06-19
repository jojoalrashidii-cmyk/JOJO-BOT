const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    ActivityType, REST, Routes
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { joinVoiceChannel } = require('@discordjs/voice');
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const config = {
    panelImage: "https://cdn.discordapp.com/attachments/1035223472898584727/1515559849436516382/panel.png",
    matchingRoomId: "1516548178382688408",
    profileRoomId: "1501583456872829068",
    autoJoinRoomId: "123456789012345678",
    colorRoomId: "1515250871313408142"
};

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const activeGames = { roulette: new Map(), mafia: new Map() };

client.once('ready', async () => {
    console.log(`تم تشغيل البوت: ${client.user.tag}`);
    client.user.setActivity('JOJO’s System', { type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' });

    // كود تسجيل الأوامر
    const commands = [
        { name: 'panel', description: 'عرض لوحة التحكم' },
        { name: 'roulette', description: 'بدء لعبة الروليت' },
        { name: 'mafia', description: 'بدء لعبة المافيا' },
        { name: 'matching', description: 'تصميم الماتشينق' },
        { name: 'افتار', description: 'تصميم الأفتار' }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ تم تسجيل الأوامر بنجاح!');
    } catch (e) { console.error(e); }

    try {
        const channel = await client.channels.fetch(config.autoJoinRoomId);
        if (channel) joinVoiceChannel({ channelId: channel.id, guildId: channel.guild.id, adapterCreator: channel.guild.voiceAdapterCreator });
    } catch (e) {}
});

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
    return canvas.toBuffer('image/png');
}

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        const { commandName, guildId, options } = interaction;
        if (commandName === 'panel') {
            const panelEmbed = new EmbedBuilder().setColor('#2b2d31').setDescription("JOJO'S control panel").setImage(config.panelImage);
            const colorRow = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('color_select').setPlaceholder('اختر لونك').addOptions([new StringSelectMenuOptionBuilder().setLabel('روم الألوان').setValue('goto_colors')]));
            await interaction.reply({ embeds: [panelEmbed], components: [colorRow] });
        }
        if (commandName === 'roulette') {
            activeGames.roulette.set(guildId, { players: new Set([interaction.user.id]) });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_roulette').setLabel('دخول').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('start_roulette').setLabel('تدوير').setStyle(ButtonStyle.Success));
            await interaction.reply({ content: `🎡 روليت: ${interaction.user}`, components: [row] });
        }
        if (commandName === 'mafia') {
            activeGames.mafia.set(guildId, { players: new Set([interaction.user.id]) });
            const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('join_mafia').setLabel('انضمام').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId('start_mafia').setLabel('توزيع الأدوار').setStyle(ButtonStyle.Danger));
            await interaction.reply({ content: `🕵️‍♂️ مافيا: ${interaction.user}`, components: [row] });
        }const { Client, SlashCommandBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createCanvas, loadImage } = require('canvas');

// تخزين مؤقت للروابط للزر (رقم الرسالة هو المفتاح)
const imageCache = new Map();

// --- دالة رسم كارت البروفايل ---
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
    return canvas.toBuffer();
}

// --- دالة رسم كارت الماتشينق ---
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
    return canvas.toBuffer();
}

// --- تنفيذ الأوامر ---
async function handleCommands(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const isMatching = interaction.commandName === 'matching';
    const banner = interaction.options.getAttachment('banner');
    const av1 = interaction.options.getAttachment('avatar1');
    const av2 = isMatching ? interaction.options.getAttachment('avatar2') : null;
    const channelId = isMatching ? '1516548178382688408' : '1501583456872829068';
    
    const buffer = isMatching ? await drawMatching(banner.url, av1.url, av2.url) : await drawProfile(banner.url, av1.url);
    const attachment = new AttachmentBuilder(buffer, { name: 'card.png' });
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('try_btn').setLabel('Try').setEmoji('1513336672870469793').setStyle(ButtonStyle.Primary)
    );

    const channel = interaction.client.channels.cache.get(channelId);
    const sentMsg = await channel.send({ files: [attachment], components: [row] });
    
    // حفظ الروابط في الكاش
    imageCache.set(sentMsg.id, { banner: banner.url, av1: av1.url, av2: av2?.url });
    await interaction.reply({ content: 'تم الإرسال للروم!', ephemeral: true });
}

// --- معالجة زر الـ Try ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;
    const data = imageCache.get(interaction.message.id);
    if (!data) return interaction.reply({ content: 'عذراً، البيانات لم تعد موجودة.', ephemeral: true });

    const files = [data.banner, data.av1];
    if (data.av2) files.push(data.av2);
    
    await interaction.reply({ content: 'تفضل، هذه هي الملفات الأصلية:', files: files, ephemeral: true });
});
        }
    }
    if (interaction.isButton()) {
        const { customId, guildId, user } = interaction;
        if (customId === 'join_roulette') { activeGames.roulette.get(guildId)?.players.add(user.id); await interaction.reply({ content: 'تم الدخول!', ephemeral: true }); }
        if (customId === 'start_roulette') { const buf = await drawRouletteResult(Array.from(activeGames.roulette.get(guildId).players)); await interaction.reply({ files: [buf] }); }
        if (customId === 'join_mafia') { activeGames.mafia.get(guildId)?.players.add(user.id); await interaction.reply({ content: 'تم الانضمام!', ephemeral: true }); }
        if (customId === 'start_mafia') {
            const p = Array.from(activeGames.mafia.get(guildId).players);
            const m = p[Math.floor(Math.random() * p.length)];
            for (const id of p) { (await client.users.fetch(id)).send(id === m ? '🕵️‍♂️ أنت المافيا!' : '🛡️ أنت مواطن.').catch(() => {}); }
            await interaction.reply('✅ تم إرسال الأدوار!');
        }
    }
});

app.get('/', (req, res) => res.send('البوت شغال 24/7!'));
app.listen(port, () => console.log(`السيرفر يعمل على المنفذ ${port}`));

client.login(process.env.TOKEN);
