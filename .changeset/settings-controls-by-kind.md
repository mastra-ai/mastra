---
'@mastra/factory': patch
---

Settings controls now match what they set instead of every choice being the same row of buttons.

**Thinking level** is a slider, not six buttons. Six buttons said "pick one of these"; a slider says what is actually true — the level is a ramp, so you drag the thumb along it. The track carries a dot per stop and fills up to the handle, and the colour turns to warning on the top two steps where the bill turns. The level is named to the left of the track in a fixed column, so "Off" and "Extra high" leave the track in the same place and nothing on the page shifts as you drag. The save only fires when you let go, so crossing the whole scale is one write, not five, and the write is optimistic: the thumb stays where you dropped it instead of the row greying out and snapping back. A per-mode row that follows the base level reads "Follows base" and grows a "Reset to base" button only once it has an override of its own. A refusal from the server puts the slider back and says why under the row that asked for it, rather than as a banner over the whole section. Arrow keys move it, and screen readers hear the level name rather than a number. One control at every width — the phone and desktop renderings are no longer two separate components.

The per-mode rows moved next to the level they follow. They set deployment defaults, but they sat in your personal card beside the session thinking level, so "Follows base" pointed at a row that was neither the base nor on the same screen. Base and modes are now one group of their own, and the session-level row that used to sit beside them is labelled for what it really is: the level for chats opened from this factory, shared with everyone working in it. Saving no longer raises a toast per change — the control already shows the new value, and it holds the stop you dropped it on until the write lands instead of flicking back and forth once.

On a deployment that refuses these writes — the defaults live in one settings file shared by everyone, so an authenticated deployment keeps them fixed — the rows now say so and render read-only, instead of letting you drag a slider that fails on release.

**Theme** uses the shared theme toggle instead of a picker built here, so System, Light and Dark read and behave the same in the Factory as everywhere else in the product.

**Completion sound** is a one-line select with a mute button tucked under its left edge, not four buttons: whether a run makes a sound and which sound it makes are two different questions. Muting swaps the icon and greys the select's label while keeping your sound, so unmuting returns to what you had. Nothing moves as you toggle, and the greyed-out select keeps its own background rather than turning translucent over the button behind it. Each pick plays, since a sound can only be judged by ear.

**Observe attachments** was a hand-rolled copy of the shared button group; it now uses the shared one, so Auto/On/Off, Notifications and the tool-permission rows stay identical — those are alternatives, not a ramp, and keep the control that says so.
