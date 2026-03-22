const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
} = require('discord.js');

// Store active giveaways in memory (persists until bot restart)
const activeGiveaways = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Start or manage a giveaway')
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start a new giveaway')
        .addStringOption((opt) =>
          opt.setName('prize').setDescription('What are you giving away?').setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('duration')
            .setDescription('Duration in minutes')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(10080) // Max 7 days
        )
        .addIntegerOption((opt) =>
          opt
            .setName('winners')
            .setDescription('Number of winners (default: 1)')
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(20)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('end').setDescription('End a giveaway early (use in the giveaway channel)')
        .addStringOption((opt) =>
          opt.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('reroll').setDescription('Pick a new winner')
        .addStringOption((opt) =>
          opt.setName('message_id').setDescription('Message ID of the giveaway').setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'start') {
      return startGiveaway(interaction);
    } else if (sub === 'end') {
      return endGiveaway(interaction);
    } else if (sub === 'reroll') {
      return rerollGiveaway(interaction);
    }
  },

  // Expose for timer callbacks
  activeGiveaways,
};

async function startGiveaway(interaction) {
  const prize = interaction.options.getString('prize');
  const duration = interaction.options.getInteger('duration');
  const winnerCount = interaction.options.getInteger('winners') || 1;

  const endsAt = Date.now() + duration * 60 * 1000;
  const endsAtUnix = Math.floor(endsAt / 1000);

  // Find giveaway channel or use current
  const giveawayChannel = interaction.guild.channels.cache.find(
    (c) => c.name.includes('giveaway') && c.isTextBased()
  );
  const targetChannel = giveawayChannel || interaction.channel;

  const embed = new EmbedBuilder()
    .setColor('#f1c40f')
    .setTitle('🎉 GIVEAWAY 🎉')
    .setDescription(
      [
        `**${prize}**`,
        '',
        `┃ React with 🎉 to enter!`,
        `┃ **${winnerCount}** winner${winnerCount > 1 ? 's' : ''}`,
        `┃ Ends <t:${endsAtUnix}:R>`,
        '',
        `Hosted by ${interaction.user}`,
      ].join('\n')
    )
    .setFooter({ text: `${winnerCount} winner${winnerCount > 1 ? 's' : ''} ┃ Ends at` })
    .setTimestamp(new Date(endsAt));

  const msg = await targetChannel.send({ embeds: [embed] });
  await msg.react('🎉');

  // Store giveaway data
  activeGiveaways.set(msg.id, {
    channelId: targetChannel.id,
    guildId: interaction.guildId,
    prize,
    winnerCount,
    endsAt,
    hostId: interaction.user.id,
  });

  // Set timer to end giveaway
  const timeout = setTimeout(async () => {
    await resolveGiveaway(interaction.client, msg.id);
  }, duration * 60 * 1000);

  activeGiveaways.get(msg.id).timeout = timeout;

  const replyText =
    targetChannel.id === interaction.channelId
      ? `✅ Giveaway started! Ends <t:${endsAtUnix}:R>`
      : `✅ Giveaway started in ${targetChannel}! Ends <t:${endsAtUnix}:R>`;

  await interaction.reply({ content: replyText, ephemeral: true });
}

async function resolveGiveaway(client, messageId) {
  const data = activeGiveaways.get(messageId);
  if (!data) return;

  try {
    const channel = await client.channels.fetch(data.channelId);
    const msg = await channel.messages.fetch(messageId);

    // Get users who reacted with 🎉
    const reaction = msg.reactions.cache.get('🎉');
    if (!reaction) return;

    const users = await reaction.users.fetch();
    const eligible = users.filter((u) => !u.bot);

    let winnerText;
    if (eligible.size === 0) {
      winnerText = 'No one entered the giveaway 😢';
    } else {
      const shuffled = [...eligible.values()].sort(() => Math.random() - 0.5);
      const winners = shuffled.slice(0, data.winnerCount);
      winnerText = winners.map((w) => `${w}`).join(', ');
    }

    const embed = new EmbedBuilder()
      .setColor('#95a5a6')
      .setTitle('🎉 GIVEAWAY ENDED 🎉')
      .setDescription(
        [
          `**${data.prize}**`,
          '',
          `┃ **Winner${data.winnerCount > 1 ? 's' : ''}:** ${winnerText}`,
          '',
          `Hosted by <@${data.hostId}>`,
        ].join('\n')
      )
      .setFooter({ text: 'Giveaway ended' })
      .setTimestamp();

    await msg.edit({ embeds: [embed] });

    if (eligible.size > 0) {
      await channel.send(`🎉 Congratulations ${winnerText}! You won **${data.prize}**!`);
    }
  } catch (err) {
    console.error('[Giveaway] Error resolving:', err.message);
  }

  // Cleanup
  if (data.timeout) clearTimeout(data.timeout);
  activeGiveaways.delete(messageId);
}

async function endGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');
  const data = activeGiveaways.get(messageId);

  if (!data) {
    return interaction.reply({ content: '❌ No active giveaway found with that message ID.', ephemeral: true });
  }

  if (data.timeout) clearTimeout(data.timeout);
  await resolveGiveaway(interaction.client, messageId);
  await interaction.reply({ content: '✅ Giveaway ended early!', ephemeral: true });
}

async function rerollGiveaway(interaction) {
  const messageId = interaction.options.getString('message_id');

  try {
    const msg = await interaction.channel.messages.fetch(messageId);
    const reaction = msg.reactions.cache.get('🎉');
    if (!reaction) {
      return interaction.reply({ content: '❌ No reactions found on that message.', ephemeral: true });
    }

    const users = await reaction.users.fetch();
    const eligible = users.filter((u) => !u.bot);

    if (eligible.size === 0) {
      return interaction.reply({ content: '❌ No eligible users to reroll.', ephemeral: true });
    }

    const shuffled = [...eligible.values()].sort(() => Math.random() - 0.5);
    const winner = shuffled[0];

    await interaction.reply(`🎉 New winner: ${winner}! Congratulations!`);
  } catch (err) {
    await interaction.reply({ content: '❌ Could not find that message.', ephemeral: true });
  }
}
