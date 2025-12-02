function usesDarkMode() {
  let youchTheme = localStorage.getItem('youch-theme')
  let hasDarkMode = false
  if (youchTheme === null) {
    hasDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  } else if (youchTheme === 'dark') {
    hasDarkMode = true
  }
  return hasDarkMode
}

function onContentLoaded(listener) {
  if (document.readyState !== 'loading') {
    listener()
    return
  }
  document.addEventListener('DOMContentLoaded', listener)
}

document.documentElement.classList.add(usesDarkMode() ? 'dark' : 'light')
