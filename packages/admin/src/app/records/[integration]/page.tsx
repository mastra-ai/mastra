export default async function Integration({ params }: { params: { integration: string } }) {
  // get field and data
  return <h1 className="text-light-text capitalize">{params.integration}</h1>;
}
