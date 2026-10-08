/*
  WhatsApp share links. wa.me/?text= opens WhatsApp (app or web) with the
  message typed in and lets the person pick the chat. The text must be
  URL-encoded; encodeURIComponent handles emoji, ₦ and Yoruba accents.
*/
export const whatsappShareUrl = (text) => `https://wa.me/?text=${encodeURIComponent(text)}`
