const hashString = (value: string) => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

type NavigatorWithDeviceMemory = Navigator & {
  deviceMemory?: number
}

export const buildFingerprint = () => {
  const navigatorWithDeviceMemory = navigator as NavigatorWithDeviceMemory

  const rawFingerprint = [
    navigator.language,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    `${screen.width}x${screen.height}`,
    `${screen.availWidth}x${screen.availHeight}`,
    `${window.devicePixelRatio || 1}`,
    navigator.platform,
    `${navigator.hardwareConcurrency ?? 0}`,
    `${navigator.maxTouchPoints ?? 0}`,
    `${navigatorWithDeviceMemory.deviceMemory ?? 0}`,
  ].join('|')

  return `fp2_${hashString(rawFingerprint)}`
}
