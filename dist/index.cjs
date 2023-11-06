var e=require("body-parser"),t=require("connect-timeout"),n=require("cors"),r=require("crypto"),o=require("express"),s=require("fs"),i=require("nedb"),u=require("path"),a=require("url"),c=require("bitcore-lib");function f(e){return e&&"object"==typeof e&&"default"in e?e:{default:e}}function d(e){if(e&&e.__esModule)return e;var t=Object.create(null);return e&&Object.keys(e).forEach(function(n){if("default"!==n){var r=Object.getOwnPropertyDescriptor(e,n);Object.defineProperty(t,n,r.get?r:{enumerable:!0,get:function(){return e[n]}})}}),t.default=e,t}var h=/*#__PURE__*/f(e),l=/*#__PURE__*/f(t),v=/*#__PURE__*/f(n),m=/*#__PURE__*/f(r),g=/*#__PURE__*/f(o),p=/*#__PURE__*/f(s),y=/*#__PURE__*/f(i),P=/*#__PURE__*/f(u),b=/*#__PURE__*/f(c);function j(){return j=Object.assign?Object.assign.bind():function(e){for(var t=1;t<arguments.length;t++){var n=arguments[t];for(var r in n)Object.prototype.hasOwnProperty.call(n,r)&&(e[r]=n[r])}return e},j.apply(this,arguments)}var w=/*#__PURE__*/function(){function e(e){this.db=new e.Datastore({filename:e.db+"/keys.db",autoload:!0}),this.wallet=e.wallet,this.config=e}var t=e.prototype;return t.setSeed=function(e){this.seed=e},t.getSeed=function(){return this.seed},t.sign=function(e){return this.wallet.sign(e.message,e.key,e.encoding)},t.encrypt=function(e){return this.wallet.encrypt(e.message,e.key)},t.findOrCreate=function(e){try{var t=this;return Promise.resolve(t.findOne(e)).then(function(n){var r,o=function(){if(!n)return Promise.resolve(t.count({})).then(function(o){return t.seed?Promise.resolve(t.wallet.create(t.seed,o,e)).then(function(e){return n=e,Promise.resolve(t.insert(n)).then(function(e){n=e})}):(console.log("Please go to http://localhost:21000 and create a wallet"),r=1,null)})}();return o&&o.then?o.then(function(e){return r?e:n}):r?o:n})}catch(e){return Promise.reject(e)}},t.findOne=function(e){var t=this;return new Promise(function(n,r){t.db.findOne(e,function(e,r){n(r?t.transform(r):null)})})},t.find=function(e){var t=this;return new Promise(function(n,r){t.db.find(e,function(e,r){n(r.map(function(e){return t.transform(e)}))})})},t.count=function(e){var t=this;return new Promise(function(n,r){t.db.count(e,function(e,t){n(t)})})},t.insert=function(e){var t=this;return new Promise(function(n,r){t.db.insert(e,function(r,o){n(t.transform(e))})})},t.transform=function(e){var t=this.wallet.derive(this.seed,e.path);return e.priv=t.privateKey.toString(),e.pub=t.publicKey.toString(),e.address=t.publicKey.toAddress().toString(),e},t.all=function(){var e=this;return new Promise(function(t,n){e.db.find({},function(n,r){t(r.map(function(t){return e.transform(t)}))})})},e}();function S(e,t,n){var r=m.default.randomBytes(16);n||(n=m.default.createHash("sha256").update(t).digest());var o=m.default.createCipheriv("aes-256-cbc",n,r),s=o.update(e);return s=Buffer.concat([s,o.final()]),{iv:r.toString("hex"),encryptedData:s.toString("hex")}}var k=/*#__PURE__*/function(){function e(e){this.db=new e.Datastore({filename:e.db+"/seed.db",autoload:!0}),this.wallet=e.wallet}var t=e.prototype;return t.get=function(e){var t=this;return new Promise(function(n,r){t.db.findOne({},function(r,o){if(o)try{var s=function(e,t,n){var r=Buffer.from(e.iv,"hex");n||(n=m.default.createHash("sha256").update(t).digest());var o=Buffer.from(e.encryptedData,"hex"),s=m.default.createDecipheriv("aes-256-cbc",n,r),i=s.update(o);return(i=Buffer.concat([i,s.final()])).toString()}(o.hex,e),i=t.wallet.seed(s);n(i)}catch(e){n(null)}else n(null)})})},t.importKey=function(e,t){var n=this;return new Promise(function(r,o){try{var s=n.wallet.seed(e);n.db.insert({hex:S(s.hex,t)},function(e,t){r(s)})}catch(e){o(e)}})},t.exportKey=function(e){try{return Promise.resolve(this.get(e)).then(function(e){return e.hex})}catch(e){return Promise.reject(e)}},t.count=function(){var e=this;return new Promise(function(t,n){e.db.count({},function(e,n){t(n)})})},t.create=function(e){var t=this;return new Promise(function(n,r){var o=t.wallet.seed();t.db.insert({hex:S(o.hex,e)},function(e,t){n(o)})})},e}(),x=/*#__PURE__*/function(){function e(e){this.db=new e.Datastore({filename:e.db+"/state.db",autoload:!0})}var t=e.prototype;return t.setState=function(e){this.state=e},t.getState=function(){return this.state},t.findOrCreate=function(e){try{var t=this;return Promise.resolve(t.findOne({host:e.host})).then(function(n){var r=function(){if(!n)return Promise.resolve(t.insert(e)).then(function(e){n=e})}();return r&&r.then?r.then(function(){return n}):n})}catch(e){return Promise.reject(e)}},t.findOne=function(e){var t=this;return new Promise(function(n,r){t.db.findOne(e,function(e,t){t?(delete t._id,n(t)):n(null)})})},t.find=function(e){var t=this;return new Promise(function(n,r){t.db.find(e,function(e,t){n(t)})})},t.delete=function(e){var t=this;return new Promise(function(n,r){t.db.remove(e,function(e,t){n(t)})})},t.count=function(e){var t=this;return new Promise(function(n,r){t.db.count(e,function(e,t){n(t)})})},t.insert=function(e){var t=this;return new Promise(function(n,r){t.db.insert(e,function(r,o){t.setState(e),n(e)})})},t.update=function(e){var t=this;return new Promise(function(n,r){t.db.update({host:e.host},{$set:e},{upsert:!0,returnUpdatedDocs:!0},function(e,r,o){console.log("UPDATED",{err:e,accessToken:o.accessToken}),t.setState(o),n(o)})})},t.all=function(){var e=this;return new Promise(function(t,n){e.db.find({},function(e,n){t(n)})})},e}(),T=b.default.deps._,O=b.default.PrivateKey,U=b.default.PublicKey,R=b.default.Address,L=b.default.encoding.BufferWriter,D=b.default.crypto.ECDSA,C=b.default.crypto.Signature,q=b.default.crypto.Hash.sha256sha256,A=b.default.util.js,B=b.default.util.preconditions,K=function e(t,n){return void 0===n&&(n="utf8"),this instanceof e?(B.checkArgument(T.isString(t),"First argument should be a string. You can specify the encoding as the second parameter"),B.checkArgument(["ascii","utf8","utf16le","ucs2","base64","latin1","binary","hex"].includes(n),"Second argument should be a valid BufferEncoding: 'utf8', 'hex', or 'base64', etc"),this.message=t,this.encoding=n,this):new e(t,n)};K.MAGIC_BYTES=Buffer.from("Bitcoin Signed Message:\n"),K.prototype.magicHash=function(){var e=L.varintBufNum(K.MAGIC_BYTES.length),t=Buffer.from(this.message,this.encoding),n=L.varintBufNum(t.length),r=Buffer.concat([e,K.MAGIC_BYTES,n,t]);return q(r)},K.prototype._sign=function(e){B.checkArgument(e instanceof O,"First argument should be an instance of PrivateKey");var t=this.magicHash(),n=new D;return n.hashbuf=t,n.privkey=e,n.pubkey=e.toPublicKey(),n.signRandomK(),n.calci(),n.sig},K.prototype.sign=function(e){var t=e.toWIF();return e=O.fromWIF(t),this._sign(e).toCompact().toString("base64")},K.prototype._verify=function(e,t){B.checkArgument(e instanceof U,"First argument should be an instance of PublicKey"),B.checkArgument(t instanceof C,"Second argument should be an instance of Signature");var n=this.magicHash(),r=D.verify(n,t,e);return r||(this.error="The signature was invalid"),r},K.prototype.verify=function(e,t){B.checkArgument(e),B.checkArgument(t&&T.isString(t)),T.isString(e)&&(e=R.fromString(e));var n=C.fromCompact(Buffer.from(t,"base64")),r=new D;r.hashbuf=this.magicHash(),r.sig=n;var o=r.toPublicKey(),s=R.fromPublicKey(o,e.network);return e.toString()!==s.toString()?(this.error="The signature did not match the message digest",!1):this._verify(o,n)},K.fromString=function(e){return new K(e)},K.fromJSON=function(e){return A.isValidJSON(e)&&(e=JSON.parse(e)),new K(e.message)},K.prototype.toObject=function(){return{message:this.message,encoding:this.encoding}},K.prototype.toJSON=function(){return JSON.stringify(this.toObject())},K.prototype.toString=function(){return this.message},K.prototype.inspect=function(){return"<Message: "+this.toString()+">"},delete global._bitcore;var _=function(e,t,n){var r=b.default.PrivateKey.fromWIF(t.priv),o=K(e,n);return{address:t.address,message:e,sig:o.sign(r),ts:Date.now()}},I={__proto__:null,sign:_,encrypt:function(e,t){var n=S(e,null,b.default.PrivateKey.fromWIF(t.priv).toBuffer());return{address:t.address,data:n,ts:Date.now()}},create:function(e,t,n){try{var r="m/44'/0'/"+t+"'/2/0",o=e.key.deriveChild(r),s=o.privateKey.toAddress().toString(),i={path:r,pub:o.publicKey.toString(),address:s,host:n.host};return Promise.resolve(i)}catch(e){return Promise.reject(e)}},seed:function(e){var t=e?Buffer.from(e,"hex"):b.default.crypto.Random.getRandomBuffer(64);try{var n=b.default.HDPrivateKey.fromSeed(t);return{hex:t.toString("hex"),key:n}}catch(e){throw console.log("error",e),e}},derive:function(e,t){return e.key.deriveChild(t)},verify:function(e,t,n,r){return K(e,r).verify(t,n)}};function E(e,t){try{var n=e()}catch(e){return t(e)}return n&&n.then?n.then(void 0,t):n}var H=function(e){try{return Promise.resolve(Promise.resolve().then(function(){/*#__PURE__*/return d(require("minidenticons"))})).then(function(t){return t.minidenticon(e)})}catch(e){return Promise.reject(e)}},N=a.fileURLToPath("undefined"==typeof document?new(require("url").URL)("file:"+__filename).href:document.currentScript&&document.currentScript.src||new URL("index.cjs",document.baseURI).href),z=u.dirname(N),F=g.default(),J=function(e){return e.origin?new URL(e.origin).host:null};exports.init=function(e){var t=e.db;p.default.existsSync(t)||p.default.mkdirSync(t,{recursive:!0});var n=new k({db:t,wallet:I,Datastore:y.default}),o=new w({db:t,wallet:I,Datastore:y.default}),s=new x({db:t,Datastore:y.default});F.set("views",P.default.join(z,"views")),F.set("view engine","ejs"),F.use(l.default("20s")),F.use(h.default.json({limit:"50mb"})),F.use(h.default.raw({type:"application/octet-stream",limit:"50mb"})),F.use(h.default.urlencoded({limit:"50mb",extended:!0})),F.use(g.default.static(P.default.join(z,"public"))),F.options("*",v.default()),F.use(g.default.urlencoded({extended:!1})),F.post("/sign",v.default(),function(e,t){try{var n=e.body.message,r=e.body.encoding||"utf8";return Promise.resolve(function(){if(o.getSeed()){var i=e.headers.authorization;return void 0===i|null===i?void t.status(401).json({error:"Please provide an access token in the Authorization header.",code:2,success:!1,errorURL:"http://localhost:21000/auth"}):Promise.resolve(s.findOne({accessToken:i})).then(function(s){if(null!=s&&s.accessToken&&s.accessToken===i){var u=i?s.host:J(e.headers);u||(u="localhost",console.log("no origin, using",u));var a=s.expireTime&&s.expireTime<Date.now();if(console.log("SIGN:",{expireTime:s.expireTime,now:Date.now(),host:u}),!a)return Promise.resolve(o.findOrCreate({host:u})).then(function(e){if(e)return Promise.resolve(o.sign({message:n,key:e,encoding:r,ts:Date.now()})).then(function(e){t.status(200).json(e)});t.status(417).json({error:"please create a wallet.",success:!1})});t.status(401).json({error:"Access token has expired.",errorURL:"http://localhost:21000/auth",code:5})}else t.status(401).json({error:"Invalid access token.",errorURL:"http://localhost:21000/auth",code:3,success:!1})})}t.status(401).json({errorURL:"http://localhost:21000/auth",error:"Check that TokenPass is running and you're signed in.",code:1})}())}catch(e){return Promise.reject(e)}}),F.post("/encrypt",v.default(),function(e,t){try{var n=e.body.message;return Promise.resolve(function(){if(o.getSeed()){var r=e.headers.authorization;return void 0===r|null===r?void t.status(401).json({error:"Please provide an access token in the Authorization header.",code:2,success:!1,errorURL:"http://localhost:21000/auth"}):(J(e.headers),Promise.resolve(s.findOne({accessToken:r})).then(function(e){if(e)return Promise.resolve(o.findOrCreate({host:e.host})).then(function(e){if(e){var r=o.encrypt({message:n,key:e}),s=r.address,i=r.data,u=r.sig,a=r.ts;console.log({address:s,data:i,sig:u,ts:a}),t.status(200).json({data:i,address:s,sig:u,ts:a})}else t.status(417).json({error:"please create a wallet."})});t.status(401).json({error:"Invalid access token.",errorURL:"http://localhost:21000/auth",code:3,success:!1})}))}t.status(401).json({errorURL:"http://localhost:21000/auth",error:"Check that TokenPass is running and you're signed in.",code:1})}())}catch(e){return Promise.reject(e)}}),F.post("/register",function(e,t){try{return Promise.resolve(n.create(e.body.password)).then(function(e){return o.setSeed(e),Promise.resolve(s.findOrCreate({host:"localhost"})).then(function(e){function n(){t.json({})}var r=function(){if(!e.icon)return e.icon="/auth/icon",Promise.resolve(s.update(e)).then(function(){})}();return r&&r.then?r.then(n):n()})})}catch(e){return Promise.reject(e)}}),F.post("/import",function(e,t){try{var r=E(function(){return Promise.resolve(n.importKey(e.body.hex,e.body.password)).then(function(e){o.setSeed(e),t.json({})})},function(){t.json({error:"invalid seed",success:!1})});return Promise.resolve(r&&r.then?r.then(function(){}):void 0)}catch(e){return Promise.reject(e)}}),F.post("/export",function(e,t){try{var r=E(function(){return Promise.resolve(n.exportKey(e.body.password)).then(function(e){e?t.json({seed:e}):t.status(401).json({error:"invalid",success:!1,errorURL:"http://localhost:21000/auth"})})},function(){});return Promise.resolve(r&&r.then?r.then(function(){}):void 0)}catch(e){return Promise.reject(e)}}),F.post("/state",v.default(),function(e,t){try{var n=new URL(e.headers.origin).host;return Promise.resolve(s.findOne({host:n})).then(function(r){function o(){t.json({success:!0})}var i=function(){if(r){var t=function(){if("clear"===e.query.mode)return Promise.resolve(s.delete({host:n})).then(function(){return Promise.resolve(s.update(j({},e.body,{host:n}))).then(function(){})});s.update(j({},e.body,{host:n}))}();if(t&&t.then)return t.then(function(){})}else s.insert(j({},e.body,{host:n}))}();return i&&i.then?i.then(o):o()})}catch(e){return Promise.reject(e)}}),F.post("/profile",v.default(),function(e,t){try{var n=function(){if(o.getSeed()){var n="global",r=E(function(){return Promise.resolve(s.findOne({host:n})).then(function(r){function o(){t.json({success:!0})}var i=j({},e.body,{host:n}),u=function(){if(r){var t=function(){s.update(i)},o=function(){if("clear"===e.query.mode)return Promise.resolve(s.delete({host:n})).then(function(){})}();return o&&o.then?o.then(t):t()}s.insert(i)}();return u&&u.then?u.then(o):o()})},function(e){console.error(e),t.status(500).json({success:!1,error:e.toString()})});if(r&&r.then)return r.then(function(){})}else t.status(401).json({error:"please check that TokenPass is running and you're signed in. check TokenPass dashboard at http://localhost:21000",code:1,errorURL:"http://localhost:21000"})}();return Promise.resolve(n&&n.then?n.then(function(){}):void 0)}catch(e){return Promise.reject(e)}}),F.delete("/state",v.default(),function(e,t){try{var n=new URL(e.headers.origin).host;return s.delete(j({},e.body,{host:n})),t.json({success:!0}),Promise.resolve()}catch(e){return Promise.reject(e)}}),F.get("/profile",v.default(),function(e,t){try{return Promise.resolve(s.findOne({host:"global"})).then(function(e){t.json(e)})}catch(e){return Promise.reject(e)}}),F.get("/state",v.default(),function(e,t){try{var n=new URL(e.headers.origin).host;return Promise.resolve(s.findOne({host:n})).then(function(e){t.json(e)})}catch(e){return Promise.reject(e)}}),F.post("/login",function(e,t){try{var r=E(function(){return Promise.resolve(n.get(e.body.password)).then(function(e){e?(o.setSeed(e),t.json({success:!0})):t.json({error:"invalid",success:!1})})},function(){});return Promise.resolve(r&&r.then?r.then(function(){}):void 0)}catch(e){return Promise.reject(e)}}),F.post("/logout",v.default(),function(e,t){o.setSeed(null),t.json({success:!0})}),F.post("/fund",v.default(),function(e,t){try{var n=o.getSeed();return Promise.resolve(function(){if(n){var r=e.headers.origin,o=r?new URL(r).host:"localhost";return Promise.resolve(s.findOne({host:o})).then(function(n){var r;if(null!=(r=n.scopes)&&r.includes("fund")){var s=n.accessToken,i=e.body.rawtx,u=E(function(){return Promise.resolve(fetch("http://localhost:21001/fund",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rawtx:i,broadcast:!0,sigma:!0,host:o,authToken:s})})).then(function(e){return Promise.resolve(e.json()).then(function(e){t.json(e)})})},function(e){console.error(e),t.status(500).json({success:!1,error:e.toString()})});return u&&u.then?u.then(function(){}):void 0}t.status(403).json({error:"Insufficient permission",code:7})})}t.status(401).json({error:"please check that TokenPass is running and you're signed in. check TokenPass dashboard at http://localhost:21000",code:1,errorURL:"http://localhost:21000/auth"})}())}catch(e){return Promise.reject(e)}}),F.post("/login",function(e,t){try{var r=E(function(){return Promise.resolve(n.get(e.body.password)).then(function(e){e?(o.setSeed(e),t.json({success:!0})):t.json({error:"invalid",success:!1})})},function(){});return Promise.resolve(r&&r.then?r.then(function(){}):void 0)}catch(e){return Promise.reject(e)}}),F.post("/auth",v.default(),function(e,t){try{return Promise.resolve(E(function(){return Promise.resolve(n.get(e.body.password)).then(function(n){return function(){if(n){var i;if(o.setSeed(n),"http://localhost:21000"!==e.headers.origin)return void t.status(403).json({error:"The origin is not authorized",code:6});var u=e.body.host;console.log({hosts:u,origin:e.headers.origin});var a=function(e){switch(e){case"forever":return 0;case"once":return 1e4;case"1h":return 36e5;case"1d":return 864e5;case"1w":return 6048e5;case"1m":return 2592e6;default:return defaultExpireTime}}(e.body.expire),c=r.randomUUID(),f=(null==(i=e.body.scopes)?void 0:i.split(","))||[],d={host:u,accessToken:c,scopes:f,icon:e.body.icon,expireTime:Date.now()+a};return Promise.resolve(s.update(d)).then(function(){t.json({success:!0,accessToken:c,expireTime:a,host:u})})}t.json({error:"invalid",success:!1})}()})},function(e){t.status(500).json({success:!1,error:e.toString()})}))}catch(e){return Promise.reject(e)}}),F.get("/prove",function(e,t){try{new URL(e.headers.origin);var n=e.query.message;return Promise.resolve((void 0)(e.query.txid)).then(function(e){if(e){var r=_(n,e);return t.json({message:r.message,key:e,address:r.address,sig:r.sig,ts:r.ts})}t.status(404).json({error:"txid not found",code:4})})}catch(e){return Promise.reject(e)}}),F.get("/auth",function(e,t){try{var n,r=new URL(e.query.returnURL).host,o=J(e.headers)||"localhost";if(o!==r)return t.status(403).json({error:"The origin is not authorized "+o+" "+r,code:6}),Promise.resolve();var s=e.query.returnURL,i=e.query.icon,u=(null==(n=e.query.scopes)?void 0:n.split(","))||[];return console.log("AUTH GET:",{returnURL:s,icon:i}),t.render("auth",{returnURL:s,icon:i,scopes:u,host:o||"lostlhost"}),Promise.resolve()}catch(e){return Promise.reject(e)}}),F.get("/auth/icon",v.default(),function(e,t){try{if("localhost:21000"!==e.headers.host)return t.status(403).json({error:"The origin is not authorized"+e.headers.origin,code:6}),Promise.resolve();t.set("Content-Type","image/svg+xml"),t.set("Cache-Control","max-age=31536000");var n=function(){if(o.getSeed())return Promise.resolve(o.findOrCreate({host:"localhost"})).then(function(e){t.send(H(e.pub))});t.send(H("Anon"))}();return Promise.resolve(n&&n.then?n.then(function(){}):void 0)}catch(e){return Promise.reject(e)}}),F.get("/",function(e,t){try{var r=o.getSeed()?Promise.resolve(o.all()).then(function(e){return Promise.resolve(s.all()).then(function(n){t.render("home",{keys:e,states:n,seed:!0})})}):Promise.resolve(n.count()).then(function(n){if(n){var r=J(e.headers);t.render("login",{host:r})}else t.render("home",{seed:!1})});return Promise.resolve(r&&r.then?r.then(function(){}):void 0)}catch(e){return Promise.reject(e)}}),F.listen(21e3,function(){console.log("TokenPass listening at http://localhost:21000")})};
//# sourceMappingURL=index.cjs.map