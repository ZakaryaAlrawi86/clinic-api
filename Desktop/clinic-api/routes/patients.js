const express = require('express');
const router = express.Router();
const controller = require('../controllers/patientController');
const upload = require('../middlewares/multer');

// عمليات المرضى
router.post('/', controller.addPatient);
router.put('/:id', controller.updatePatient);
router.delete('/:id', controller.deletePatient);
router.get('/search', controller.searchPatients);
router.get('/:id/visits', controller.getPatientVisits);

// الزيارات
router.post('/:id/visits', upload.array('images'), controller.addVisit);
router.put('/visits/:visitId', controller.updateVisit);
router.delete('/visits/:visitId', controller.deleteVisit);

// الصور
router.post('/visits/:visitId/images', upload.single('image'), controller.addImageToVisit);
router.put('/images/:imageId', upload.single('image'), controller.updateVisitImage);
router.delete('/images/:imageId', controller.deleteVisitImage);


module.exports = router;
