const {
    Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
    ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    ActivityType, REST, Routes
} = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { joinVoiceChannel } = require('@discordjs/voice');

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
        }
        if (commandName === 'matching') {
            await interaction.reply({ content: '⏳ جاري التصميم...', ephemeral: true });
            const template = await loadImage(options.getAttachment('template').url);
            const canvas = createCanvas(1200, 700);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(template, 0, 0, 1200, 700);
            const drawCircularImage = async (url, x, y, size) => {
                const img = await loadImage(url);
                ctx.save(); ctx.beginPath(); ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
                ctx.closePath(); ctx.clip(); ctx.drawImage(img, x, y, size, size); ctx.restore();
            };
            await drawCircularImage(options.getAttachment('avatar_1').url, 150, 400, 250);
            await drawCircularImage(options.getAttachment('avatar_2').url, 800, 400, 250);
            const targetChannel = await client.channels.fetch(config.matchingRoomId);
            await targetChannel.send({ files: [{ attachment: canvas.toBuffer('image/png'), name: 'matching.png' }] });
            await interaction.editReply({ content: '✅ تم إرسال الماتشينق!' });
        }
        if (commandName === 'افتار') {
            await interaction.reply({ content: '⏳ جاري تصميم البروفايل...', ephemeral: true });
            const template = await loadImage(options.getAttachment('template').url);
            const canvas = createCanvas(1200, 700);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(template, 0, 0, 1200, 700);
            const avatar = await loadImage(interaction.user.displayAvatarURL({ extension: 'png' }));
            ctx.save(); ctx.beginPath(); ctx.arc(200, 500, 125, 0, Math.PI * 2);
            ctx.closePath(); ctx.clip(); ctx.drawImage(avatar, 75, 375, 250, 250); ctx.restore();
            const targetChannel = await client.channels.fetch("1501583456872829068");
            await targetChannel.send({ files: [{ attachment: canvas.toBuffer('image/png'), name: 'profile.png' }] });
            await interaction.editReply({ content: '✅ تم إرسال الأفتار للروم المطلوب!' });
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

// سيرفر بسيط عشان الـ UptimeRobot
app.get('/', (req, res) => res.send('البوت شغال 24/7!'));
app.listen(port, () => console.log(`السيرفر يعمل على المنفذ ${port}`));

// باقي الكود الخاص بك...
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

// ... (هنا ضع بقية الكود الخاص بك من أول client.once إلى ما قبل تسجيل الدخول)

// 2. تسجيل الدخول باستخدام المتغير البيئي (Environment Variable)

client.login(process.env.TOKEN);

