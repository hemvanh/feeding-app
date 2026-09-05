import { useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

export function QrScanner({
  error,
  onClose,
  onScan,
}: {
  error: string
  onClose: () => void
  onScan: (text: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onScanRef = useRef(onScan)
  const [camError, setCamError] = useState('')

  onScanRef.current = onScan

  useEffect(() => {
    const media = videoRef.current
    const canvas = canvasRef.current
    if (!media) return
    const video: HTMLVideoElement = media

    let stream: MediaStream | null = null
    let raf = 0
    let stopped = false
    let lastText = ''

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' } },
        })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        video.srcObject = stream
        await video.play()

        let detector: BarcodeDetector | null = null
        const Detector = window.BarcodeDetector
        if (typeof Detector === 'function') {
          try {
            detector = new Detector({ formats: ['qr_code'] })
          } catch {
            detector = null
          }
        }

        const ctx = canvas?.getContext('2d', { willReadFrequently: true }) ?? null

        const tick = async () => {
          if (stopped) return
          if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
            try {
              let value = ''
              if (detector) {
                const codes = await detector.detect(video)
                value = codes[0]?.rawValue ?? ''
              } else if (canvas && ctx && video.videoWidth > 0) {
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                ctx.drawImage(video, 0, 0)
                const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
                value =
                  jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' })?.data ??
                  ''
              }
              if (value && value !== lastText) {
                lastText = value
                onScanRef.current(value)
              }
            } catch {
              /* keep scanning */
            }
          }
          raf = requestAnimationFrame(() => {
            void tick()
          })
        }
        void tick()
      } catch {
        setCamError('Camera access is needed to scan. Allow the camera, then try again.')
      }
    }

    void start()
    return () => {
      stopped = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  return (
    <div className="confirm-backdrop" onClick={onClose}>
      <div
        className="qr-scan-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-scan-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="qr-scan-title">Scan pet QR</h2>
        {camError ? (
          <p className="error">{camError}</p>
        ) : (
          <>
            <video ref={videoRef} className="qr-scan-video" autoPlay muted playsInline />
            <canvas ref={canvasRef} className="qr-scan-canvas" />
            <p className="muted">Point the camera at the sticker. This opens Record feeding.</p>
          </>
        )}
        {error ? <p className="error">{error}</p> : null}
        <button type="button" className="ghost-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
