# Banner images

Drop banner art in this folder to put a full width image across the top of a
Components V2 box. Each banner is optional: if the file is missing, that message
simply renders without a banner (no errors), so you can add them one at a time.

## How it works

The bot uploads the image with the message as an attachment, so the art lives in
this repo and there is no external image host to break or expire. Filenames must
match exactly (lowercase, `.png`).

## Filenames the bot looks for

| File | Where it shows |
|------|----------------|
| `rules.png` | The Server Rules box (posted by `/setup`) |
| `how-it-works.png` | The "Welcome to Dollar Vibe Club" box (posted by `/setup`) |
| `pick-your-path.png` | The role picker box (posted by `/setup`) |
| `welcome.png` | The welcome box shown when a member joins |
| `live.png` | The live / video notifications opt-in panel (`/livenotify`) |
| `leaderboard.png` | The `/leaderboard` box |

## Image spec

- Format: PNG (transparent or solid background both work).
- Shape: wide banner. Recommended **1200 x 400 px** (a 3:1 header shape).
- Keep it under a few MB. Discord scales it to the width of the box and keeps the
  aspect ratio, so design at 2x for crisp rendering on high resolution screens.
- Leave a little breathing room around any text in the art, since Discord rounds
  the corners.

## Adding more banners later

Any message can get a banner by calling `banneredContainer(color, '<key>')` in the
code and dropping a matching `<key>.png` here. Ask and I will wire up more
(giveaways, rank cards, the YouTube posts, and so on).
