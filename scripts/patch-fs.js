const fs = require("fs");
fs.realpathSync.native = fs.realpathSync;
fs.realpath.native = fs.realpath;
if (fs.promises) {
  fs.promises.realpath = async (path, options) => {
    return new Promise((resolve, reject) => {
      fs.realpath(path, options, (err, res) => {
        if (err) reject(err);
        else resolve(res);
      });
    });
  };
}
