exports.up = (pgm) => {
  pgm.addColumn("users", {
    features: {
      type: "varchar[]",
      notNUll: true,
      default: "{}",
    },
  });
};

exports.down = false;
