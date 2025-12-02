//#region src/components/EventSchemas.ts
/**
* Provide an `EventSchemas` class to type events, providing type safety when
* sending events and running functions via Inngest.
*
* You can provide generated Inngest types, custom types, types using Zod, or
* a combination of the above. See {@link EventSchemas} for more information.
*
* @example
*
* ```ts
* export const inngest = new Inngest({
*   id: "my-app",
*   schemas: new EventSchemas().fromZod({
*     "app/user.created": {
*       data: z.object({
*         id: z.string(),
*         name: z.string(),
*       }),
*     },
*   }),
* });
* ```
*
* @public
*/
var EventSchemas = class {
	runtimeSchemas = {};
	addRuntimeSchemas(schemas) {
		this.runtimeSchemas = {
			...this.runtimeSchemas,
			...schemas
		};
	}
	/**
	* Use generated Inngest types to type events.
	*/
	fromGenerated() {
		return this;
	}
	/**
	* Use a `Record<>` type to type events.
	*
	* @example
	*
	* ```ts
	* export const inngest = new Inngest({
	*   id: "my-app",
	*   schemas: new EventSchemas().fromRecord<{
	*     "app/user.created": {
	*       data: {
	*         id: string;
	*         name: string;
	*       };
	*     };
	*   }>(),
	* });
	* ```
	*/
	fromRecord(..._args) {
		return this;
	}
	/**
	* Use a union type to type events.
	*
	* @example
	*
	* ```ts
	* type AccountCreated = {
	*   name: "app/account.created";
	*   data: { org: string };
	*   user: { id: string };
	* };
	*
	* type AccountDeleted = {
	*   name: "app/account.deleted";
	*   data: { org: string };
	*   user: { id: string };
	* };
	*
	* type Events = AccountCreated | AccountDeleted;
	*
	* export const inngest = new Inngest({
	*   id: "my-app",
	*   schemas: new EventSchemas().fromUnion<Events>(),
	* });
	* ```
	*/
	fromUnion() {
		return this;
	}
	/**
	* Use Zod to type events.
	*
	* @deprecated Use {@link fromSchema}.
	*
	* @example
	*
	* ```ts
	* export const inngest = new Inngest({
	*   id: "my-app",
	*   schemas: new EventSchemas().fromZod({
	*     "app/user.created": {
	*       data: z.object({
	*         id: z.string(),
	*         name: z.string(),
	*       }),
	*     },
	*   }),
	* });
	* ```
	*/
	fromZod(schemas) {
		let runtimeSchemas;
		if (Array.isArray(schemas)) runtimeSchemas = schemas.reduce((acc, schema) => {
			const { name: { value: name },...rest } = schema.shape;
			return {
				...acc,
				[name]: rest
			};
		}, {});
		else runtimeSchemas = schemas;
		this.addRuntimeSchemas(runtimeSchemas);
		return this;
	}
	/**
	* Use anything compliant with Standard Schema to type events.
	*
	* @example
	*
	* ```ts
	* export const inngest = new Inngest({
	*   id: "my-app",
	*   schemas: new EventSchemas().fromSchema({
	*     "app/user.created": z.object({
	*       id: z.string(),
	*       name: z.string(),
	*     }),
	*   }),
	* });
	* ```
	*/
	fromSchema(schemas) {
		this.addRuntimeSchemas(Object.entries(schemas).reduce((acc, [name, schema]) => {
			return {
				...acc,
				[name]: { data: schema }
			};
		}, {}));
		return this;
	}
};

//#endregion
export { EventSchemas };
//# sourceMappingURL=EventSchemas.js.map