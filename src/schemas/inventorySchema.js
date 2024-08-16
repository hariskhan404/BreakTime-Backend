const addInventorySchema = {
	headers: {
	  type: "object",
	  properties: {
		authorization: { type: "string" },
	  },
	  required: ["authorization"],
	},
	// No body validation here since we're handling multipart/form-data
  };
  
const getDashboarcInventorySchema = {
	headers : {
		type: "object",
		properties: {
			authorization: { type: "string" },
		},
		required: ["authorization"],
	}
};

module.exports = {
	addInventorySchema,
	getDashboarcInventorySchema,
};
