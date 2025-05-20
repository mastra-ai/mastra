import { ImgHTMLAttributes, useEffect, useState } from 'react';

export const ImageWithFallback = ({ alt, src, ...rest }: ImgHTMLAttributes<HTMLImageElement>) => {
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
  }, [src]);

  return error || !src ? (
    <div>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth="1.5"
        stroke="currentColor"
        width="150"
        height="150"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
        />
      </svg>
      <p className="text-xs italic text-muted-foreground -mt-[0.625rem] mb-[0.625rem]">Image link is broken</p>
    </div>
  ) : (
    <img
      src={src}
      alt={alt}
      {...rest}
      onError={() => {
        setError(true);
      }}
    />
  );
};
