// A lossless, readable tabular view of the published menu, shared by exports.
export function menuTables(content) {
  const menu=content.menu;
  const groups=new Map(menu.groups.map(group=>[group.id,group]));
  const categories=new Map(menu.categories.map(category=>[category.id,category]));
  const scopedGroups=extra=>extra.groupIds??(extra.groupId?[extra.groupId]:[]);
  const scopedCategories=extra=>extra.categoryIds??[];
  const applicable=category=>menu.extras.filter(extra=>scopedGroups(extra).includes(category.groupId)||scopedCategories(extra).includes(category.id));
  const items=[...menu.items].sort((a,b)=>{
    const ac=categories.get(a.categoryId),bc=categories.get(b.categoryId);
    return menu.groups.findIndex(g=>g.id===ac?.groupId)-menu.groups.findIndex(g=>g.id===bc?.groupId)||
      (ac?.order??0)-(bc?.order??0)||(a.order??0)-(b.order??0);
  });
  const itemHeaders=['Item ID','Category','Subcategory','Item','Description','Options','Available','Featured','Extras sections','Category ID','Subcategory ID','Item order'];
  const priceHeaders=['Category','Subcategory','Item','Price option','USD','LBP','Description','Options','Available','Featured','Extras sections','Item ID','Price option number','Category ID','Subcategory ID'];
  const itemRows=items.map(item=>{
    const category=categories.get(item.categoryId),group=groups.get(category?.groupId);
    return [item.id,group?.label??'',category?.label??'',item.name,item.details??'',(item.options??[]).join(' · '),item.available!==false,item.featured===true,category?applicable(category).map(extra=>extra.label).join(' · '):'',group?.id??'',item.categoryId,item.order??0];
  });
  const priceRows=items.flatMap(item=>{
    const category=categories.get(item.categoryId),group=groups.get(category?.groupId);
    return (item.prices?.length?item.prices:[{}]).map((price,index)=>[group?.label??'',category?.label??'',item.name,price.label??'',price.usd??null,price.lbp??null,item.details??'',(item.options??[]).join(' · '),item.available!==false,item.featured===true,category?applicable(category).map(extra=>extra.label).join(' · '):'',item.id,index+1,group?.id??'',item.categoryId]);
  });
  const extraRows=menu.extras.flatMap(extra=>extra.items.map(item=>[
    extra.label,item.name,item.usd??null,item.lbp??null,
    scopedGroups(extra).map(id=>groups.get(id)?.label??id).join(' · '),
    scopedCategories(extra).map(id=>{const c=categories.get(id);return c?`${groups.get(c.groupId)?.label??c.groupId} / ${c.label}`:id;}).join(' · '),
    menu.categories.filter(category=>scopedGroups(extra).includes(category.groupId)||scopedCategories(extra).includes(category.id)).map(category=>`${groups.get(category.groupId)?.label??category.groupId} / ${category.label}`).join(' · '),
    extra.id,item.id,scopedGroups(extra).join(' | '),scopedCategories(extra).join(' | ')
  ]));
  return [
    {id:'items',title:'All items',headers:itemHeaders,rows:itemRows},
    {id:'prices',title:'All prices',headers:priceHeaders,rows:priceRows},
    ...menu.groups.map(group=>({id:'group-'+group.id,title:group.label,headers:priceHeaders,rows:priceRows.filter(row=>row[13]===group.id)})),
    {id:'extras',title:'Extras',headers:['Extras section','Extra','USD','LBP','Whole categories','Specific subcategories','Effective subcategories','Section ID','Extra ID','Category IDs','Subcategory IDs'],rows:extraRows},
    {id:'categories',title:'Categories',headers:['Category','Subcategory','Category ID','Subcategory ID','Subcategory order','Menu item count'],rows:menu.categories.map(category=>[groups.get(category.groupId)?.label??'',category.label,category.groupId,category.id,category.order??0,menu.items.filter(item=>item.categoryId===category.id).length])}
  ];
}

export function tableCSV(table) {
  const cell=value=>{
    // Menu names must remain text when imported into a spreadsheet.
    let text=value==null?'':String(value);
    if(typeof value==='string'&&/^[\s]*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return [table.headers,...table.rows].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
