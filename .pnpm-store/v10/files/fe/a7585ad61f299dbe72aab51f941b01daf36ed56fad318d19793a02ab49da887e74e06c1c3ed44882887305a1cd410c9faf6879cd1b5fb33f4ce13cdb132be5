type JsDocType = JsDocBaseType | JsDocElementsType;
interface JsDocBaseType {
    name: string;
}
interface JsDocElementsType extends JsDocBaseType {
    elements: JsDocType[];
}
interface JsDocProperty {
    description: string | null;
    type: JsDocType | null;
}
interface JsDocParam extends JsDocProperty {
    name: string;
    optional?: boolean;
}
interface JsDoc {
    description: string | null;
    params: JsDocParam[];
    returns: JsDocProperty | null;
}
export default function parseJsDoc(docblock: string): JsDoc;
export {};
