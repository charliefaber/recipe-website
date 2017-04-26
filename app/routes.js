//app/routes.js
var assert = require('assert');
var MongoClient = require('mongodb').MongoClient;
var configDb = require('../config/database.js');
var path = require('path');
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var textract = require('textract');
//var auth = require('../config/auth.js');
var bcrypt = require('bcrypt-nodejs');
var salt = bcrypt.genSaltSync(10);

module.exports = function(app){

var authAdmin = function(req, res, next) {
  if(req.session && req.session.admin)
    return next();
  else
  res.sendFile(path.join(__dirname, "../views/login.html"));
};

app.get('/upload', authAdmin, function(req, res) {
  res.render(path.join(__dirname, "../views/upload.handlebars"),{redirect: false});
});

app.get('/', authAdmin, function(req, res) {
    MongoClient.connect(configDb.url, function(err, db) {
    assert.equal(null, err);

        db.collection('recipes').find().sort({ date: -1}).limit(5).toArray(function(err, items) {
            var admin = req.session.user;
            console.log(admin == "admin");
            if(admin == "admin") 
                res.render(path.join(__dirname, '../views/indexAdmin.handlebars'), { items: items});
            else 
                res.render(path.join(__dirname, '../views/index.handlebars'), { items: items});
        });
    });
});

app.get('/createAccount', function(req,res) {
  res.sendFile(path.join(__dirname, "../views/createAccount.html"));
});

app.get('/login', function(req, res) {
  res.sendFile(path.join(__dirname, "../views/login.html"));
});

app.get('/logout', function(req, res) {
  var user = req.session.user;
  console.log("logging out " + user);
  req.session.destroy();
  res.redirect('/');
});

app.get('/delete/:recipe',authAdmin,function(req,res) {
  var recipe = req.params.recipe;

  MongoClient.connect(configDb.url, function(err, db) {
    assert.equal(null, err);

    db.collection('recipes').find({_id: recipe}).toArray(function(err, items) {
      db.collection('deleted').insertOne(items[0]);
      console.log(JSON.stringify(items));
    });

    db.collection('recipes').remove({_id: recipe});
    res.redirect('/');
  });
});




app.post('/search', function(req, res) {
  var search = req.body.searchText;         
  var filter = req.body.filterSelect;     
  var any = false, breakfast = false, lunch = false, dinner = false, dessert = false, other = false;

  if(filter == null || filter == undefined || filter == "" || filter == "Any Meal") {
    any = true;
  }
  else if(filter == "Breakfast") {
    breakfast = true;
  }
  else if(filter == "Lunch") {
    lunch = true;
  }
  else if(filter == "Dinner") {
    dinner = true;
  } 
  else {
    other = true;
  }

  var buttonVals = {filter: filter, any: any, breakfast: breakfast, lunch: lunch, dinner:dinner, other: other};

  MongoClient.connect(configDb.url, function(err, db) {
    assert.equal(null, err);

    db.collection('recipes').find(
      {$text: {$search: search}},
      {score: {$meta: "textScore"}}
      ).sort({ score: {$meta: "textScore"}}).toArray(function(err, items) {
        console.log(JSON.stringify(items));

        if(filter == "Breakfast") {
          items = items.filter(function(a) {
            return a.meal == "Breakfast";
          });
        }
        else if(filter == "Lunch") {
          items = items.filter(function(a) {
            return a.meal == "Lunch";
          });
        }
        else if(filter == "Dinner") {
          items = items.filter(function(a) {
            return a.meal == "Dinner";
          });
        }
        else if(filter == "Dessert") {
          items = items.filter(function(a) {
            return a.meal == "Dessert";
          });
        }
        else if(filter == "Other") {
          items = items.filter(function(a) {
            return a.meal == "Other";
          });
        }

        var fail = false;
        if(items[0] == null) {
          fail = true;
        }

        var user = req.session.user;
        if(user == "admin") 
          res.render(path.join(__dirname, '../views/resultsAdmin.handlebars'), {search: search, buttonVals: buttonVals, items: items, fail: fail});
        else 
          res.render(path.join(__dirname, '../views/results.handlebars'), {search: search, buttonVals: buttonVals, items: items, fail: fail});
      });
    db.close();
  });
});

app.post('/createAccount', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  var hashPass = bcrypt.hashSync(password, salt);
  MongoClient.connect(configDb.url, function(err, db) {
    assert.equal(null, err);

      db.collection('users').insert({name: username, password: hashPass});
      res.sendFile(path.join(__dirname, '../views/login.html'));

    
    db.close();
  });
});

app.post('/checkLogin', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  MongoClient.connect(configDb.url, function(err, db) {
    db.collection('users').find({name: username}).toArray(function(err, items) {
      if(items[0] == undefined) {
        res.redirect('/login');
      } 
      else if(bcrypt.compareSync(password, items[0].password)) {
        req.session.admin = true;
        req.session.user = username;
        res.redirect('/');
      }
      else {
        res.redirect('/login');
      }
    });
  });
});

app.post('/upload', function(req, res) {

  var name = req.body.name;
  var _id = name.replace(/\s+/g, '');

  var meal = req.body.meal;
  var servings = req.body.servings;
  var prep = req.body.prep;
  var date = new Date();

  var upload = {_id: _id, name: name, meal: meal, servings: servings, prep:prep, date: date};

  res.render(path.join(__dirname, '../views/upload.handlebars'), {upload: upload, redirect: true})
  MongoClient.connect(configDb.url, function(err, db) {
    assert.equal(null, err);
    
    db.collection('recipes').insertOne(upload);
    db.close();
  });

});
};
