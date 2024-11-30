'use server';

export async function submitTravelForm(formData: FormData) {
  // Convert FormData to a regular object for logging
  const formObject: Record<string, any> = {};
  formData.forEach((value, key) => {
    formObject[key] = value;
  });

  console.log('Travel Form Submission:', formObject);

  return {
    message: 'Form submitted successfully!',
  };
}
