require('dotenv').config();
const { Client, GatewayIntentBits, AttachmentBuilder, ActivityType, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, WebhookClient } = require('discord.js');
const { joinVoiceChannel } = require('@discordjs/voice');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const express = require('express');
const path = require('path');
const fs = require('fs');

// --- إعدادات ثابتة ---
const WEBHOOK_URL = 'https://discord.com/api/webhooks/1518610511183478864/AkY2C6ye3hoq9iVm0OTJ4Ol-NucsVGBxQvjzGEOzxFjzSllBa4_sfU3PfqXQTG3jk3Xy';
const TARGET_CHANNEL_ID = '1501583456872829068'; 
const BUTTON_CHANNEL_ID = '1501583456872829068'; 
const VOICE_CHANNEL_ID = '1518127536834613360';
const ROLE_ID = '1501374221992071348';
const FONT_NAME = 'MyCustomFont';
// رابط الفوتر الجديد
const FOOTER_IMG_URL = 'https://cdn.discordapp.com/attachments/1035223472898584727/1518614099376869376/IMG_6674.png';

const fontPath = path.join(__dirname, 'font.ttf');
if (fs.existsSync(fontPath)) {
    GlobalFonts.registerFromPath(fontPath, FONT_NAME);
}

const app = express();
app.listen(process.env.PORT || 3000);

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates] 
});

const isProcessing = new Set();
const webhookClient = new WebhookClient({ url: WEBHOOK_URL });

function drawImageCover(ctx, img, x, y, width, height) {
    const ratio = Math.max(width / img.width, height / img.height);
    const sWidth = width / ratio;
    const sHeight = height / ratio;
    const sx = (img.width - sWidth) / 2;
    const sy = (img.height - sHeight) / 2;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, width, height);
}

async function createProfileCard(bannerUrl, avatarUrl, member) {
    const canvas = createCanvas(1000, 600);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0f0f0f';
    ctx.fillRect(0, 0, 1000, 600);

    const banner = await loadImage(bannerUrl);
    drawImageCover(ctx, banner, 30, 30, 940, 280); 

    ctx.save();
    ctx.beginPath();
    ctx.arc(150, 370, 85, 0, Math.PI * 2);
    ctx.clip();
    const avatar = await loadImage(avatarUrl);
    ctx.drawImage(avatar, 65, 285, 170, 170);
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 32px "${FONT_NAME}"`;
    ctx.fillText(member.user.username, 260, 380);
    
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `18px "${FONT_NAME}"`;
    ctx.fillText('@' + member.user.username.toLowerCase(), 260, 410);

    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(50, 480);
    ctx.lineTo(950, 480);
    ctx.stroke();

    ctx.fillStyle = '#666666';
    ctx.font = `bold 12px "${FONT_NAME}"`;
    ctx.fillText('MEMBER SINCE', 50, 520);
    ctx.fillText('JOINED SERVER', 550, 520);

    ctx.fillStyle = '#ffffff';
    ctx.font = `16px "${FONT_NAME}"`;
    ctx.fillText(member.user.createdAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 50, 550);
    ctx.fillText(member.joinedAt.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'}), 550, 550);

    return canvas;
}

client.once(Events.ClientReady, async (c) => {
    client.user.setPresence({ activities: [{ name: 'JOJO’s Designs', type: ActivityType.Streaming, url: 'https://www.twitch.tv/discord' }], status: 'online' });
    const vc = client.channels.cache.get(VOICE_CHANNEL_ID);
    if (vc) joinVoiceChannel({ channelId: vc.id, guildId: vc.guild.id, adapterCreator: vc.guild.voiceAdapterCreator });
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.content.startsWith('!design') || isProcessing.has(message.author.id)) return;
    if (!message.member.roles.cache.has(ROLE_ID)) return message.reply('❌ ليس لديك الصلاحية.');
    if (message.attachments.size < 2) return message.reply('⚠️ يرجى إرفاق صورتين.');

    isProcessing.add(message.author.id);
    try {
        const canvas = await createProfileCard(message.attachments.first().url, message.attachments.at(1).url, message.member);
        const buffer = await canvas.encode('png');
        const attachment = new AttachmentBuilder(buffer, { name: 'profile.png' });
        
        await webhookClient.send({
            files: [attachment],
            embeds: [{
                color: 0x2A4660,
                image: { url: 'attachment://profile.png' },
                footer: { 
                    text: '7OJO3 Profiles || بروفايلات 7OJO3',
                    icon_url: FOOTER_IMG_URL // استخدام الرابط الجديد هنا
                }
            }]
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('try_design').setLabel('Try').setStyle(ButtonStyle.Secondary).setEmoji('1518609977386733678'),
            new ButtonBuilder().setCustomId('send_dm').setLabel('DM').setStyle(ButtonStyle.Secondary).setEmoji('1518609977386733678')
        );

        const buttonChannel = client.channels.cache.get(BUTTON_CHANNEL_ID);
        if (buttonChannel) {
            await buttonChannel.send({ 
                content: `🎨 الأزرار الخاصة بتصميم: ${message.author}`,
                components: [row] 
            });
        }

        await message.reply('✅ تم إرسال التصميم والأزرار بنجاح.');
    } catch (err) {
        console.error(err);
        message.reply('❌ حدث خطأ أثناء المعالجة.');
    } finally {
        isProcessing.delete(message.author.id);
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'try_design') {
        await interaction.reply({ content: '🎨 أرسل الصورتين (البانر والأفاتار) مجدداً للتجربة!', ephemeral: true });
    } else if (interaction.customId === 'send_dm') {
        try {
            const canvas = await createProfileCard(interaction.message.attachments.first()?.url || 'https://via.placeholder.com/150', 'https://via.placeholder.com/150', interaction.member);
            const buffer = await canvas.encode('png');
            await interaction.user.send({ content: '📸 إليك تصميمك:', files: [new AttachmentBuilder(buffer, { name: 'profile.png' })] });
            await interaction.reply({ content: '✅ تم الإرسال للخاص!', ephemeral: true });
        } catch (err) {
            await interaction.reply({ content: 'تسوقمها؟ خاصك مقفل كيف تبيني ارسلك الافتارات؟ افتح الخاص يا وحش!', ephemeral: true });
        }
    }
});

client.login(process.env.TOKEN);
