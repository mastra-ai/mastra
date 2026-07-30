interface IntakeIconProps {
  size?: number;
  className?: string;
}

export function IntakeIcon({ size = 16, className }: IntakeIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 14.67C11.68 14.67 14.67 11.68 14.67 8C14.67 4.32 11.68 1.33 8 1.33C4.32 1.33 1.33 4.32 1.33 8C1.33 11.68 4.32 14.67 8 14.67ZM9.14 5.53C8.88 5.27 8.46 5.27 8.2 5.53C7.93 5.79 7.93 6.21 8.2 6.47L9.06 7.33H5.33C4.97 7.33 4.67 7.63 4.67 8C4.67 8.37 4.97 8.67 5.33 8.67H9.06L8.2 9.53C7.93 9.79 7.93 10.21 8.2 10.47C8.46 10.73 8.88 10.73 9.14 10.47L11.14 8.47C11.4 8.21 11.4 7.79 11.14 7.53L9.14 5.53Z"
        fill="currentColor"
      />
    </svg>
  );
}
