# Mobile review checklist

Anna VetoLayer lets the Anna shell own the viewport. Its layout uses the platform safe-area insets on every screen edge, keeps interactive controls at least 44 px high, and does not rely on window size or window-position APIs.

Before Marketplace submission, test this sequence in the Anna mobile shell on a notched device (or its device preview):

1. Launch the app in portrait, submit an evaluation, and confirm the result, Copy, Export, and Send to chat controls remain reachable above the home indicator.
2. Open Reviews and approve or block an item using touch; switch all receipt filters using touch.
3. Rotate to landscape, return to portrait, and confirm the navigation, form, and receipt table remain usable.
4. Focus the summary, evidence, and rollback fields in turn; confirm the virtual keyboard does not hide the field or the submit control.
5. Capture one portrait and one landscape Marketplace screenshot after this walkthrough, with no content beneath the notch, status chrome, or home indicator.
