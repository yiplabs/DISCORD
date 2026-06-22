const { SlashCommandBuilder } = require('discord.js');
const { COLORS, V2_FLAGS, ContainerBuilder, text, separator, gallery } = require('../utils/components');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('showcase')
    .setDescription('Show off a project you built')
    .addStringOption((opt) =>
      opt.setName('title').setDescription('Project name').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('description').setDescription('What does it do? (1-2 sentences)').setRequired(true)
    )
    .addStringOption((opt) =>
      opt.setName('link').setDescription('Live URL or repo link').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('stack')
        .setDescription('Tech stack used (e.g. Next.js, Supabase, Tailwind)')
        .setRequired(false)
    )
    .addAttachmentOption((opt) =>
      opt.setName('screenshot').setDescription('Screenshot of your project').setRequired(false)
    ),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const link = interaction.options.getString('link');
    const stack = interaction.options.getString('stack');
    const screenshot = interaction.options.getAttachment('screenshot');

    // Find the showcase channel
    const showcaseChannel = interaction.guild.channels.cache.find(
      (c) => c.name.includes('showcase') && c.isTextBased()
    );

    const targetChannel = showcaseChannel || interaction.channel;

    const url = link.startsWith('http') ? link : `https://${link}`;

    const detailLines = [
      `🔗 **Link** • ${link}`,
      `👤 **Builder** • ${interaction.user}`,
    ];
    if (stack) {
      detailLines.push(`⚙️ **Stack** • ${stack}`);
    }

    const container = new ContainerBuilder()
      .setAccentColor(COLORS.success)
      .addTextDisplayComponents(text(`## 🚀 [${title}](${url})`))
      .addTextDisplayComponents(text(description))
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(text(detailLines.join('\n')));

    if (screenshot) {
      container.addMediaGalleryComponents(gallery(screenshot.url));
    }

    container
      .addSeparatorComponents(separator())
      .addTextDisplayComponents(
        text(`-# Shipped by ${interaction.user.displayName} ┃ Dollar Vibe Club`)
      );

    const msg = await targetChannel.send({
      components: [container],
      flags: V2_FLAGS,
      allowedMentions: { parse: [] },
    });

    // Auto-react with fire and eyes
    await msg.react('🔥').catch(() => {});
    await msg.react('👀').catch(() => {});

    // Confirm to user
    const replyText =
      targetChannel.id === interaction.channelId
        ? '✅ Project posted!'
        : `✅ Project posted in ${targetChannel}!`;

    await interaction.reply({ content: replyText, ephemeral: true });
  },
};
