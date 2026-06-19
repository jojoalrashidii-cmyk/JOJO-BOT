const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers],
    partials: [Partials.Channel, Partials.Message, Partials.User]
});

const config = {
    token: "OTEyMzYzNTk5MjUzNjAyMzc0.GKs2v2.gMNLiNgeYAjg-0fGhxZTtZWvlZ_Ozxl6WEtdYc",
    profileRoomId: "1501583456872829068",
    colorsRoomId: "1512520871313408142"
};

client.once('ready', () => {
    console.log(`تم تشغيل البوت: ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
    // --- قسم الأوامر ---
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'بانل') {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ticket').setLabel('انقر هنا للتذكرة').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('colors').setLabel('اختر لونك').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('steal').setLabel('ازرف افتار').setStyle(ButtonStyle.Danger)
            );
            await interaction.reply({ content: 'لوحة التحكم الخاصة بسيرفر جوجو:', components: [row] });
        }

        if (interaction.commandName === 'ضع_افتار') {
            await interaction.reply({ content: 'جاري معالجة طلبك (يجب إضافة كود Canvas هنا)...' });
            // هنا يوضع كود الرسم وارساله لروم 1501583456872829068
        }
    }

    // --- قسم الأزرار ---
    if (interaction.isButton()) {
        if (interaction.customId === 'colors') {
            await interaction.reply({ content: `انتقل إلى روم الألوان: <#${config.colorsRoomId}>`, ephemeral: true });
        }
        
        if (interaction.customId === 'ticket') {
            // هنا تفتح الـ Modal الخاص بالشكوى
            await interaction.reply({ content: 'جارٍ فتح التذكرة...', ephemeral: true });
        }
    }
});

client.login(config.token);