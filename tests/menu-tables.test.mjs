import test from 'node:test';
import assert from 'node:assert/strict';
import seed from '../public/site-content/default.json' with {type:'json'};
import {menuTables,tableCSV} from '../lib/menu-tables.mjs';

test('Menu exports preserve every item, numeric price variant, description and scoped extra',()=>{
  const tables=menuTables(seed),items=tables.find(t=>t.id==='items'),prices=tables.find(t=>t.id==='prices'),extras=tables.find(t=>t.id==='extras');
  assert.equal(items.rows.length,seed.menu.items.length);
  assert.equal(prices.rows.length,seed.menu.items.reduce((n,item)=>n+Math.max(1,item.prices.length),0));
  for(const item of seed.menu.items){
    const row=items.rows.find(row=>row[0]===item.id);
    assert.equal(row[4],item.details);assert.equal(row[5],item.options.join(' · '));
    item.prices.forEach((price,index)=>{
      const row=prices.rows.find(row=>row[11]===item.id&&row[12]===index+1);
      assert.equal(row[4],price.usd);assert.equal(row[5],price.lbp);
    });
  }
  assert.equal(extras.rows.length,seed.menu.extras.reduce((n,extra)=>n+extra.items.length,0));
  assert.ok(extras.rows.filter(row=>row[7]==='bread-extras').every(row=>row[4]===''&&row[5]==='Food / Sandwiches'));
  assert.ok(extras.rows.filter(row=>row[7]==='coffee-extras').every(row=>row[4]==='Coffee'&&row[6].includes('Cold Coffee')));
  assert.ok(items.rows.filter(row=>row[10]==='food-salads').every(row=>!row[8].includes('bread')));
  assert.equal(tables.filter(t=>t.id.startsWith('group-')).reduce((n,t)=>n+t.rows.length,0),prices.rows.length);
});

test('CSV preserves quotes/newlines and prevents menu text from becoming formulas',()=>{
  const csv=tableCSV({headers:['Text','Price'],rows:[['=IMPORTXML("bad")',0],['line\n"two"',null]]});
  assert.ok(csv.includes('"\'=IMPORTXML(""bad"")","0"'));
  assert.ok(csv.includes('"line\n""two""",""'));
});
