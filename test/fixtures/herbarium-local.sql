-- A local stand-in for the Herbarium's MySQL database, to try the survey without Clever.
-- Same table as demo-python-mysql-cellar creates (herbarium/db.py), a few fictional rows.
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS herbarium_local CHARACTER SET utf8mb4;
USE herbarium_local;
CREATE TABLE IF NOT EXISTS specimens (
  id INTEGER NOT NULL AUTO_INCREMENT,
  latin_name VARCHAR(120) NOT NULL,
  common_name VARCHAR(120) NOT NULL,
  family VARCHAR(60) NOT NULL,
  locality VARCHAR(120) NOT NULL,
  collected_on DATE NOT NULL,
  collector VARCHAR(80) NOT NULL,
  object_key VARCHAR(200) NOT NULL,
  content_type VARCHAR(40) NOT NULL,
  byte_size INTEGER NOT NULL,
  drawing VARCHAR(40),
  seed_key VARCHAR(40),
  created_sql TEXT,
  created_at DATETIME NOT NULL DEFAULT now(),
  PRIMARY KEY (id),
  UNIQUE (seed_key)
);
CREATE INDEX ix_specimens_family ON specimens (family);
INSERT IGNORE INTO specimens (latin_name, common_name, family, locality, collected_on, collector, object_key, content_type, byte_size, drawing, seed_key) VALUES
 ('Quercus robur', 'English oak', 'Fagaceae', 'Forêt de Tronçais', '1887-05-14', 'H. Brissac', 'sheets/seed/oak.svg', 'image/svg+xml', 61234, 'oak/1', 'seed-oak'),
 ('Ginkgo biloba', 'Maidenhair tree', 'Ginkgoaceae', 'Jardin des Plantes', '1889-10-02', 'A. Delorme', 'sheets/seed/ginkgo.svg', 'image/svg+xml', 58410, 'ginkgo/1', 'seed-ginkgo'),
 ('Papaver rhoeas', 'Corn poppy', 'Papaveraceae', 'Plaine de la Beauce', '1891-06-21', 'H. Brissac', 'sheets/seed/poppy.svg', 'image/svg+xml', 60102, 'poppy/1', 'seed-poppy'),
 ('Fagus sylvatica', 'Common beech', 'Fagaceae', 'Forêt de Fontainebleau', '1890-09-11', 'Proof Run', 'sheets/2026/11/fagus.png', 'image/png', 1518, NULL, NULL);
