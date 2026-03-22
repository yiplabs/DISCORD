const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

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

    const embed = new EmbedBuilder()
      .setColor('#2ecc71')
      .setTitle(`🚀 ${title}`)
      .setURL(link.startsWith('http') ? link : `https://${link}`)
      .setDescription(description)
      .addFields(
        { name: '🔗 Link', value: link, inline: true },
        { name: '👤 Builder', value: `${interaction.user}`, inline: true }
      )
      .setFooter({ text: `Shipped by ${interaction.user.displayName} ┃ TommyYipXYZ's Hub` })
      .setTimestamp();

    if (stack) {
      embed.addFields({ name: '⚙️ Stack', value: stack, inline: true });
    }

    if (screenshot) {
      embed.setImage(screenshot.url);
    }

    const msg = await targetChannel.send({ embeds: [embed] });

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
