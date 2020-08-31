const fs = require('fs')
const bodyParser = require('body-parser')
const jsonServer = require('json-server')
const jwt = require('jsonwebtoken')

const server = jsonServer.create()
const router = jsonServer.router('./database.json')
const userdb = JSON.parse(fs.readFileSync('./users.json', 'UTF-8'))
const productsdb = JSON.parse(fs.readFileSync('./products.json', 'UTF-8'))

server.use(bodyParser.urlencoded({ extended: true }))
server.use(bodyParser.json())
server.use(jsonServer.defaults());

const SECRET_KEY = '123456789'

const expiresIn = '12h'

// Create a token from a payload 
function createToken(payload) {
  return jwt.sign(payload, SECRET_KEY, { expiresIn })
}

// Verify the token 
function verifyToken(token) {
  return jwt.verify(token, SECRET_KEY, (err, decode) => decode !== undefined ? decode : err)
}

// Check if the user exists in database
function isAuthenticated({ email, password }) {
  const userdb = JSON.parse(fs.readFileSync('./users.json', 'UTF-8'))
  const databasedb = JSON.parse(fs.readFileSync('./database.json', 'UTF-8'))
  const userIndex = userdb.users.findIndex(user => user.email === email && user.password === password)
  console.log(userIndex)
  if (userIndex !== -1) {
    let clientIndex = databasedb.clients.findIndex(client => client.id === userdb.users[userIndex].id)
    return { id, email, address, firstname, lastname, phone, zone, gender } = databasedb.clients[clientIndex]
  } else {
    return false;
  }
}

function zeroPad(num, places) {
  var zero = places - num.toString().length + 1;
  return Array(+(zero > 0 && zero)).join("0") + num;
}

// Register New User
server.post('/auth/register', (req, res) => {
  console.log("register endpoint called; request body:");
  console.log(req.body);
  const { email, password, address, approval, firstname, lastname, phone, zone, gender } = req.body;

  if (isAuthenticated({ email, password }) === false) {
    const status = 401;
    const message = 'Email and Password already exist';
    res.status(status).json({ status, message });
    return
  }

  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401
      const message = err
      res.status(status).json({ status, message })
      return
    };

    // Get current users data
    var data = JSON.parse(data.toString());

    // Get the id of last user
    var last_item_id = data.users[data.users.length - 1].id + 1;

    //Add new user
    data.users.push({
      id: last_item_id,
      email: email,
      password: password
    });


    //add some data
    var writeData = fs.writeFile("./users.json", JSON.stringify(data), (err, result) => {  // WRITE
      if (err) {
        const status = 401
        const message = err
        res.status(status).json({ status, message })
        return
      }
    });

    fs.readFile("./database.json", (err, data2) => {
      if (err) {
        const status = 401
        const message = err
        res.status(status).json({ status, message })
        return
      };
      // Get current users data2
      var data2 = JSON.parse(data2.toString());

      //Add user info to clients array in database
      data2.clients.push({
        id: last_item_id,
        email: email,
        address: address,
        approval: approval,
        firstname: firstname,
        lastname: lastname,
        phone: phone,
        zone: zone,
        gender: gender
      });

      //add some data
      var writeData = fs.writeFile("./database.json", JSON.stringify(data2), (err, result) => {  // WRITE
        if (err) {
          const status = 401
          const message = err
          res.status(status).json({ status, message })
          return
        }
      });

    })
  });

  // Create token for new user
  const access_token = createToken({ email, password })
  console.log("Access Token:" + access_token);
  res.status(200).json({ access_token })
})

// Validate User Purchase
server.post('/auth/purchase', (req, res) => {
  var { id, purchaseId, date, activeTime, totalBasket, delivery, total, products, textarea, agreement, status } = req.body;

  fs.readFile("./database.json", (err, data) => {
    if (err) {
      const status = 401
      const message = err
      res.status(status).json({ status, message })
      return
    };
    // Get current users data
    var data = JSON.parse(data.toString());

    let clientIndex = data.clients.findIndex(client => client.id === id)
    if (clientIndex !== -1) {
      if (purchaseId) {
        let purchaseIndex = data.clients[clientIndex].transactions.findIndex(transaction => transaction.purchaseId === purchaseId)
        data.clients[clientIndex].transactions[purchaseIndex] = {
          purchaseId: purchaseId,
          date: date,
          activeTime: activeTime,
          totalBasket: totalBasket,
          delivery: delivery,
          textarea: textarea,
          agreement: agreement,
          total: total,
          status: status,
          products: products
        }

      } else {

        purchaseId = data.clients[clientIndex].transactions.length + 1
        purchaseId = zeroPad(purchaseId, 4);

        data.clients[clientIndex].transactions.push({
          purchaseId: purchaseId,
          date: date,
          activeTime: activeTime,
          totalBasket: totalBasket,
          delivery: delivery,
          textarea: textarea,
          agreement: agreement,
          total: total,
          status: status,
          products: products
        })
      }
    }

    //add some data
    var writeData = fs.writeFile("./database.json", JSON.stringify(data), (err, result) => {  // WRITE
      if (err) {
        const status = 401
        const message = err
        res.status(status).json({ status, message })
        return
      }
    });
    res.status(200).json({ message: 'User purchase validated' })

  })


})

// Reset User Password
server.patch('/auth/reset', (req, res) => {
  const { id, oldPassword, newPassword } = req.body;

  fs.readFile("./users.json", (err, data) => {
    if (err) {
      const status = 401
      const message = err
      res.status(status).json({ status, message })
      return
    };

    // Get current users data
    var data = JSON.parse(data.toString());

    const userIndex = data.users.findIndex(user => user.id === id && user.password === oldPassword)
    if (userIndex !== -1) {
      data.users[userIndex].password = newPassword


      //add some data
      var writeData = fs.writeFile("./users.json", JSON.stringify(data), (err, result) => {  // WRITE
        if (err) {
          const status = 401
          const message = err
          res.status(status).json({ status, message })
          return
        }
      });
    } else {
      const status = 401;
      const message = 'password mismatched';
      res.status(status).json({ status, message });
      return
    }

    res.status(200).json({ message: 'Password updated' })
  });


})

// Login to one of the users from ./users.json
server.post('/auth/login', (req, res) => {
  console.log("login endpoint called; request body:");
  console.log(req.body);
  const { email, password } = req.body;
  const profile = isAuthenticated({ email, password })

  if (profile === false) {
    const status = 401
    const message = 'Incorrect email or password'
    res.status(status).json({ status, message })
    return
  }
  const access_token = createToken({ email, password })
  console.log("Access Token:" + access_token);
  console.log("profile:" + profile);
  res.status(200).json({ access_token, profile })
})

server.get('/products', (req, res) => {

  res.send(productsdb.products)
})


server.use(/^(?!\/auth).*$/, (req, res, next) => {
  if (req.headers.authorization === undefined || req.headers.authorization.split(' ')[0] !== 'Bearer') {
    const status = 401
    const message = 'Error in authorization format'
    res.status(status).json({ status, message })
    return
  }
  try {
    let verifyTokenResult;
    verifyTokenResult = verifyToken(req.headers.authorization.split(' ')[1]);

    if (verifyTokenResult instanceof Error) {
      const status = 401
      const message = 'Access token not provided'
      res.status(status).json({ status, message })
      return
    }
    next()
  } catch (err) {
    const status = 401
    const message = 'Error access_token is revoked'
    res.status(status).json({ status, message })
  }
})

server.use(router)

server.listen(8000, () => {
  console.log('Run Auth API Server')
})