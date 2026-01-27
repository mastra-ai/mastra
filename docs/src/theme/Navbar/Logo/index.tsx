import React, { type ReactNode } from 'react'
import Logo from '@theme/Logo'

export default function NavbarLogo(): ReactNode {
  return (
    <Logo
      className="navbar__brand"
      imageClassName="navbar__logo"
      titleClassName="navbar__title text--truncate"
    />
  )
}
