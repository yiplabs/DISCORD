// ─── COMPONENTS V2 HELPERS ───
// Shared builders + brand palette for the "container" boxes that replaced the
// old embeds across the bot. Every message built with these must be sent with
// `flags: V2_FLAGS` and may NOT include `content` or `embeds`.

const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  SectionBuilder,
  ThumbnailBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags,
} = require('discord.js');

// Components V2 accent colors are integers, not the hex strings embeds used.
const COLORS = {
  brand: 0x9b59b6, // purple — default hub identity
  success: 0x2ecc71, // green — level ups, showcases
  gold: 0xf1c40f, // yellow — giveaways, leaderboard
  youtube: 0xff0000, // red — YouTube uploads / live
  muted: 0x95a5a6, // grey — ended / neutral states
};

// Flag every Components V2 message must carry.
const V2_FLAGS = MessageFlags.IsComponentsV2;

/** A single block of markdown text. */
function text(content) {
  return new TextDisplayBuilder().setContent(content);
}

/** A horizontal divider — pass `true` for a larger gap. */
function separator(large = false) {
  return new SeparatorBuilder().setSpacing(
    large ? SeparatorSpacingSize.Large : SeparatorSpacingSize.Small
  );
}

/** Text with an image floated to the right (replaces embed thumbnail/author icon). */
function thumbnailSection(content, url) {
  return new SectionBuilder()
    .addTextDisplayComponents(text(content))
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(url));
}

/** A full-width image gallery (replaces embed `setImage`). */
function gallery(...urls) {
  return new MediaGalleryBuilder().addItems(
    ...urls.map((u) => new MediaGalleryItemBuilder().setURL(u))
  );
}

module.exports = {
  COLORS,
  V2_FLAGS,
  ContainerBuilder,
  text,
  separator,
  thumbnailSection,
  gallery,
};
