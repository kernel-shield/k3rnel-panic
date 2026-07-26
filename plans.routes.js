const express = require('express');
const db = require('../db');

const router = express.Router();

function serializePlan(p) {
  return {
    id: p.id, tier: p.tier, name: p.name, tag: p.tag,
    price: p.price, cores: p.cores, ram: p.ram, disk: p.disk,
    port: p.port, bw: p.bw, backup: !!p.backup,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM plans ORDER BY tier, sort_order').all();
  res.json({
    essential: rows.filter(p => p.tier === 'essential').map(serializePlan),
    premium: rows.filter(p => p.tier === 'premium').map(serializePlan),
  });
});

module.exports = router;
