export function openPetQrPrintSheet(): void {
  const url = new URL(window.location.href)
  url.hash = '/print-qrs'
  const popup = window.open(url.toString(), 'pet-qr-print', 'popup=yes,width=980,height=1200')
  if (!popup) window.location.hash = '/print-qrs'
  else popup.focus()
}
