import ComposeForm from './compose-form';
import ComposeHeader from './compose-header';

export default function ComposePage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <ComposeHeader />
      <div className="container mx-auto p-4 max-w-3xl">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-6">Compose Email</h1>
          <ComposeForm />
        </div>
      </div>
    </div>
  );
}
