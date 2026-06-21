require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ActivityType, Events, PermissionsBitField, ComponentType } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const express = require('express');

const app = express();
app.get('/', (req, res) => res.send('Bot is running!'));
app.listen(process.env.PORT || 3000);

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

async function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const targetRatio = w / h;
    let sWidth, sHeight, sx, sy;
    if (imgRatio > targetRatio) {
        sWidth = img.height * targetRatio;
        sHeight = img.height;
        sx = (img.width - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = img.width;
        sHeight = img.width / targetRatio;
        sx = 0;
        sy = (img.height - sHeight) / 2;
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
}

async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#0a0a0a'; 
    ctx.fillRect(0, 0, 1000, 600);
    
    const banner = await loadImage(bannerUrl);
    await drawImageCover(ctx, banner, 0, 0, 1000, 300);
    
    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 400, 90, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    await drawImageCover(ctx, avatar, 60, 310, 180, 180);
    ctx.restore();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 45px "Times New Roman"';
    ctx.fillText(member.user.username, 270, 400);
    
    ctx.fillStyle = '#888888';
    ctx.font = '22px Arial';
    ctx.fillText('@' + member.user.username.toLowerCase(), 270, 435);
    
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(50, 500); 
    ctx.lineTo(950, 500);
    ctx.stroke();
    
    ctx.fillStyle = '#777777';
    ctx.font = 'bold 18px "Times New Roman"';
    ctx.fillText('MEMBER SINCE', 50, 540);
    ctx.fillText('JOINED SERVER', 500, 540);
    
    ctx.fillStyle = '#ffffff';
    ctx.font = '24px "Times New Roman"';
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 50, 575);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 500, 575);
    
    return new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });
}

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design')) return;
    if (!message.member.roles.cache.has(ROLE_ID)) return;
    if (message.attachments.size < 2) return;
    
    const att = Array.from(message.attachments.values());
    const data = { bannerUrl: att[0].url, avatarUrl: att[1].url };
    designCache.set(message.author.id, data);
    
    const card = await createProfileCard(data.bannerUrl, data.avatarUrl, message.member);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('try_btn').setLabel('Try').setEmoji(EMOJI_ID).setStyle(ButtonStyle.Secondary)
    );

    const channel = client.channels.cache.get(TARGET_CHANNEL_ID);
    await channel.send({ files: [card], components: [row] });
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
