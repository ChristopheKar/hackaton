const path = require('path')
const express = require('express');
const router = express.Router();

router.get('/', function(req, res, next) {
    res.send("Home Router Test");
});

router.use('/index', express.static(path.join('public', 'index.html')));

router.use('/css', express.static('public/css'));
router.use('/js', express.static('public/js'));
router.use('/images', express.static('public/images'));

module.exports = router;
