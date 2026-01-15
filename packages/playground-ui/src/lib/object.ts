/**
 * Checks if object is empty
 * @param objectName
 * @returns boolean
 */
export const isObjectEmpty = (objectName: Object) => {
  return objectName && Object.keys(objectName).length === 0 && objectName.constructor === Object;
};
