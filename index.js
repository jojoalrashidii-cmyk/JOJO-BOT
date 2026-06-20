require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, ActivityType } = require('discord.js');
const express = require('express');

// خادم Express لتثبيت البوت (لا تحذفيه)
const app = express();
app.get('/', (req, res) => res.send('البوت يعمل!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.once('ready', async () => {
    // تفعيل الـ Streaming
    client.user.setActivity('JOJO’s Designs', {
        type: ActivityType.Streaming,
        url: 'https://www.twitch.tv/discord'
    });

    // تسجيل الأوامر
    const commands = [
        { 
            name: 'profile', 
            description: 'عرض بروفايل سريع', 
            options: [{ name: 'user', type: 6, description: 'اختر مستخدم', required: true }] 
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log(`✅ البوت يعمل الآن: ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'profile') {
        const user = interaction.options.getUser('user');
        
        // الرد الفوري (بدون أي تأخير)
        await interaction.reply({
            embeds: [{
                color: 0x2b2d31,
                title: `بروفايل: ${user.username}`,
                image: { url: user.displayAvatarURL({ size: 1024, dynamic: true }) },
                footer: { text: 'تم الجلب فوراً' }
            }]
        });
    }
});

client.login(process.env.TOKEN);
