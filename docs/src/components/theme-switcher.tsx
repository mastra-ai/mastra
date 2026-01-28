import { useColorMode } from '@docusaurus/theme-common'
import IconDarkMode from '@theme/Icon/DarkMode'
import IconLightMode from '@theme/Icon/LightMode'
import IconSystemColorMode from '@theme/Icon/SystemColorMode'
import { disableTransitions } from '../utils/disableTransitions'

export const ThemeSwitcher = () => {
  const { colorModeChoice, setColorMode } = useColorMode()

  const toggleTheme = ({ colorMode }: { colorMode: typeof colorModeChoice }) => {
    const enableTransitions = disableTransitions()
    setColorMode(colorMode)
    setTimeout(() => {
      enableTransitions()
    }, 0)
  }

  const getAriaLabel = () => {
    return colorModeChoice === 'light' ? 'light mode' : colorModeChoice === 'dark' ? 'dark mode' : 'system mode'
  }

  return (
    <button
      onClick={() =>
        toggleTheme({
          colorMode: colorModeChoice === 'light' ? 'dark' : colorModeChoice === 'dark' ? null : 'light',
        })
      }
      className="w-fit cursor-pointer rounded-[10px] border-0 bg-transparent p-2 text-black transition-colors ease-linear hover:bg-(--mastra-surface-3) hover:text-black dark:text-white hover:dark:bg-[#121212] dark:hover:text-white"
      aria-label={getAriaLabel()}
      title={getAriaLabel()}
    >
      {colorModeChoice === 'light' ? (
        <IconLightMode className="size-5" />
      ) : colorModeChoice === 'dark' ? (
        <IconDarkMode className="size-5" />
      ) : (
        <IconSystemColorMode className="size-5" />
      )}
      <span className="sr-only">{getAriaLabel()}</span>
    </button>
  )
}
