import { InputField, type InputFieldProps } from '@/components/ui/elements';

export function SearchField(props: InputFieldProps) {
  return (
    <InputField
      labelIsHidden={true}
      {...props}
      className="[&>input]:pl-[2.5rem]"
      style={{
        background: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' fill='gray' viewBox='0 0 24 24'><path d='M21 20l-5.6-5.6a7 7 0 1 0-1.4 1.4L20 21zM4 10a6 6 0 1 1 12 0 6 6 0 0 1-12 0z'/></svg>") no-repeat 8px center`,
        backgroundSize: '1.5rem 1.5rem',
      }}
    />
  );
}
