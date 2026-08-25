CREATE TABLE IF NOT EXISTS restaurants (
  id UUID PRIMARY KEY, name VARCHAR(180) NOT NULL, cuisine VARCHAR(180) NOT NULL DEFAULT 'Multi-cuisine',
  address TEXT NOT NULL DEFAULT '', image_url TEXT, rating NUMERIC(2,1) NOT NULL DEFAULT 4.2,
  delivery_minutes INT NOT NULL DEFAULT 35, is_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS menu_items (
  id UUID PRIMARY KEY, restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name VARCHAR(180) NOT NULL, description TEXT NOT NULL DEFAULT '', category VARCHAR(100) NOT NULL DEFAULT 'Main Course',
  price NUMERIC(10,2) NOT NULL, image_url TEXT, is_veg BOOLEAN NOT NULL DEFAULT FALSE,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_menu_restaurant ON menu_items(restaurant_id);

INSERT INTO restaurants(id,name,cuisine,address,image_url,rating,delivery_minutes,is_open) VALUES
('11111111-1111-1111-1111-111111111111','SS Hyderabad Biryani','Biryani, Indian, South Indian','Kilpauk, Chennai','https://images.unsplash.com/photo-1563379091339-03246963d29c?auto=format&fit=crop&w=900&q=80',4.5,35,true),
('22222222-2222-2222-2222-222222222222','RNR Biryani - Taste Of 1953','Biryani, North Indian','Egmore, Chennai','https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=900&q=80',4.3,30,true),
('33333333-3333-3333-3333-333333333333','Chennai Tiffin House','South Indian, Tiffin, Vegetarian','T. Nagar, Chennai','https://images.unsplash.com/photo-1630383249896-424e482df921?auto=format&fit=crop&w=900&q=80',4.6,25,true),
('44444444-4444-4444-4444-444444444444','Spice Route Kitchen','Indian, Chinese, Starters','Anna Nagar, Chennai','https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=80',4.4,40,true) ON CONFLICT(id) DO NOTHING;

INSERT INTO menu_items(id,restaurant_id,name,description,category,price,image_url,is_veg,is_enabled) VALUES
('db74ac5c-1652-580c-bba9-62c23f65eebe','11111111-1111-1111-1111-111111111111','Chicken Biryani','Fragrant basmati rice, tender chicken and signature spices.','Biryani',12.5,'https://images.unsplash.com/photo-1563379091339-03246963d29c?auto=format&fit=crop&w=700&q=80',false,true),
('7375f2f4-2cad-5391-bc91-d0a83629052d','11111111-1111-1111-1111-111111111111','Mutton Biryani','Slow-cooked mutton with aromatic rice and saffron.','Biryani',15.9,'https://images.unsplash.com/photo-1599043513900-ed6fe01d4e05?auto=format&fit=crop&w=700&q=80',false,true),
('6134a045-5212-514c-b020-32be716e6bb6','11111111-1111-1111-1111-111111111111','Chicken 65','Crispy South Indian fried chicken with curry leaves.','Starters',8.5,'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=80',false,true),
('7ccd7a1e-096c-5c55-a707-2d8bb32cb554','11111111-1111-1111-1111-111111111111','Paneer Tikka','Char-grilled paneer, peppers and aromatic masala.','Starters',8.25,'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=700&q=80',true,true),
('353c6d2b-a4c1-5235-9ef8-733112963c37','11111111-1111-1111-1111-111111111111','Veg Biryani','Basmati rice, seasonal vegetables and whole spices.','Biryani',9.75,'https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=700&q=80',true,true),
('995f8b30-497f-5d90-87e1-2e644c5ae2fe','11111111-1111-1111-1111-111111111111','Butter Chicken','Creamy tomato curry with tender chicken.','Curries',13.25,'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=700&q=80',false,true),
('1d730993-cf1b-584a-b383-59b018ff05c8','11111111-1111-1111-1111-111111111111','Garlic Naan','Soft tandoor naan topped with garlic and coriander.','Breads',3.5,'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=80',true,true),
('de610c10-333c-5e20-bead-78bb2905ecf4','11111111-1111-1111-1111-111111111111','Gulab Jamun','Warm milk dumplings soaked in rose-cardamom syrup.','Desserts',4.25,'https://images.unsplash.com/photo-1666190094764-2c2c4c9a1a2f?auto=format&fit=crop&w=700&q=80',true,true)
ON CONFLICT(id) DO NOTHING;

INSERT INTO menu_items(id,restaurant_id,name,description,category,price,image_url,is_veg,is_enabled) VALUES
('a07cc9cd-ca02-596d-9773-678b06c20936','22222222-2222-2222-2222-222222222222','Egg Biryani','Aromatic biryani rice with boiled eggs and fried onions.','Biryani',10.5,'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=80',false,true),
('aacdd769-9912-553f-aac1-1c5b0069b51c','22222222-2222-2222-2222-222222222222','Fish Biryani','Fragrant rice layered with spiced fish and herbs.','Biryani',14.75,'https://images.unsplash.com/photo-1516684732162-798a0062be99?auto=format&fit=crop&w=700&q=80',false,true),
('ed80f4ea-8173-5f60-acba-7c9d6e549a2a','22222222-2222-2222-2222-222222222222','Chicken Tikka','Tandoori chicken pieces marinated in yogurt and spices.','Starters',9.25,'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=700&q=80',false,true),
('0d34288b-184a-51a0-83ef-98d7460d611c','22222222-2222-2222-2222-222222222222','Kebab Platter','Mixed grilled kebabs with mint chutney.','Starters',11.9,'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80',false,true),
('90456e4f-9b24-560d-a0a4-97c2bbc2bd4c','22222222-2222-2222-2222-222222222222','Dal Makhani','Slow-cooked black lentils finished with butter.','Curries',8.75,'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=700&q=80',true,true),
('f4e5338f-b356-5dd2-8188-ea3be4be1d91','22222222-2222-2222-2222-222222222222','Chicken Curry','Classic Indian chicken curry with onion-tomato masala.','Curries',11.75,'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?auto=format&fit=crop&w=700&q=80',false,true)
ON CONFLICT(id) DO NOTHING;

INSERT INTO menu_items(id,restaurant_id,name,description,category,price,image_url,is_veg,is_enabled) VALUES
('2e233c1e-02bb-5b1a-9e71-c68fc55e891c','33333333-3333-3333-3333-333333333333','Masala Dosa','Crisp dosa filled with potato masala, served with chutneys.','Tiffin',6.5,'https://images.unsplash.com/photo-1668236543090-82eba5ee5976?auto=format&fit=crop&w=700&q=80',true,true),
('515c563e-9bbe-51e5-a089-0132b4ba5c26','33333333-3333-3333-3333-333333333333','Idli Sambar','Steamed rice cakes with hot sambar and chutney.','Tiffin',5.25,'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=700&q=80',true,true),
('41aec7ea-4bad-50eb-bd7d-0e0d5e6d2abb','33333333-3333-3333-3333-333333333333','Medu Vada','Crispy lentil doughnuts with sambar and coconut chutney.','Tiffin',5.75,'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=700&q=80',true,true),
('4520efaa-e9d7-5420-8a52-cce76b5adf98','33333333-3333-3333-3333-333333333333','Pongal','Comforting rice and lentil pongal with pepper and ghee.','Tiffin',6.25,'https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=700&q=80',true,true),
('699bc8ba-3073-56d9-9661-cd80253315a0','33333333-3333-3333-3333-333333333333','Poori Masala','Fluffy pooris with spiced potato masala.','Breakfast',6.75,'https://images.unsplash.com/photo-1626132647523-66f5bf380027?auto=format&fit=crop&w=700&q=80',true,true),
('974b76bc-57e3-567d-a0e3-f9b625697160','33333333-3333-3333-3333-333333333333','Filter Coffee','Traditional South Indian filter coffee.','Beverages',2.75,'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=700&q=80',true,true)
ON CONFLICT(id) DO NOTHING;

INSERT INTO menu_items(id,restaurant_id,name,description,category,price,image_url,is_veg,is_enabled) VALUES
('a1a7133c-4880-5d50-8ccf-a31d7d0eb6f2','44444444-4444-4444-4444-444444444444','Veg Fried Rice','Wok-tossed rice with vegetables and spring onion.','Rice',8.25,'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=700&q=80',true,true),
('f6f130bc-f633-5a2a-b6d7-848daa5be331','44444444-4444-4444-4444-444444444444','Chicken Noodles','Hakka noodles tossed with chicken and vegetables.','Noodles',9.5,'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=700&q=80',false,true),
('12efc739-eef1-5ec3-9c8e-71376f40386e','44444444-4444-4444-4444-444444444444','Chilli Paneer','Crispy paneer in a sweet-spicy Indo-Chinese sauce.','Starters',8.75,'https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=700&q=80',true,true),
('731465db-114c-5ed9-a68b-d880f92bee12','44444444-4444-4444-4444-444444444444','Spring Rolls','Crispy vegetable rolls with chilli dipping sauce.','Starters',6.25,'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=700&q=80',true,true),
('63938d25-543b-5ff4-98d0-da1d9cd32b52','44444444-4444-4444-4444-444444444444','Manchurian','Crispy vegetable balls in a glossy Manchurian sauce.','Starters',7.5,'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=700&q=80',true,true),
('cb2871d0-9eac-50a3-930c-a535c8a2b2ec','44444444-4444-4444-4444-444444444444','Chocolate Brownie','Warm chocolate brownie served as a sweet finish.','Desserts',5.5,'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=700&q=80',true,true)
ON CONFLICT(id) DO NOTHING;

