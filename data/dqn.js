/* Data for js/anim-dqn.js (Hierarchical Dueling Deep Q-Learning for Intrusion Detection).
   Real numbers come from github.com/Logan-Cole-Luna/Hierarchical-Q-Learning-Threat-Hunting:
     results/binary_classification/binary_classification_report.csv
     results/multi_class_classification/rl_classification_report.csv
     results/multi_class_classification/rl_confusion_matrix.png (counts)
     results/*_shap_summary.png (mean |SHAP|, read off the saved bar charts)
     utils/q_network.py (40 -> 128 -> 64, value head 1, advantage head 5)
   The "flows" list is ILLUSTRATIVE: hand-made example flows that use the repo's real
   class and feature names. Their feature values, SHAP lengths and Q-values are not model outputs. */
window.DQN_DATA = {
  total: 2177804,                         // flows evaluated by the high-level agent
  binaryAccuracy: 0.99977,
  multiAccuracy: 0.99684,
  net: { input: 40, hidden: [128, 64], actions: 5 },

  // high-level agent (XGBoost): benign vs malicious
  benign: { name: "Benign", support: 1935399, recall: 0.99996 },
  // low-level agent (dueling DQN) on the 242,405 malicious flows; order = action index
  classes: [
    { name: "Botnet",      support: 28907,  recall: 0.98862 },
    { name: "Brute-force", support: 18820,  recall: 0.99915 },
    { name: "DDoS attack", support: 155191, recall: 1.00000 },
    { name: "DoS attack",  support: 39314,  recall: 0.99372 },
    { name: "Web attack",  support: 173,    recall: 0.00000 }   // 112 of 173 predicted DDoS attack, 60 Botnet, 1 DoS
  ],

  // features shown on the flow card: the top two by mean |SHAP| for each agent
  features: [
    { name: "Init Fwd Win Byts", stage: 1, shap: 3.19 },
    { name: "Init Bwd Win Byts", stage: 1, shap: 2.67 },
    { name: "RST Flag Cnt",      stage: 2, shap: 0.047 },
    { name: "PSH Flag Cnt",      stage: 2, shap: 0.038 }
  ],

  // ILLUSTRATIVE flows. v = values of the four features above, k = per-flow SHAP scale (0..1),
  // label = true class, pred = routed class (-1 = benign), V/A = illustrative value and advantage outputs.
  flows: [
    { id: "0412", proto: "TCP", port: 443,  v: [65535, 29200, 0, 1], k: [.7, .6, .3, .3], label: -1, pred: -1 },
    { id: "0413", proto: "TCP", port: 80,   v: [8192, 211, 0, 1],    k: [.9, .8, .6, .9], label: 2, pred: 2,
      V: 1.35, A: [-0.6, -1.1, 1.9, 0.4, -0.3] },
    { id: "0417", proto: "TCP", port: 80,   v: [225, 211, 0, 1],     k: [.8, .9, .5, .8], label: 3, pred: 3,
      V: 1.2, A: [-0.7, -0.2, 0.5, 1.7, -0.9] },
    { id: "0421", proto: "UDP", port: 53,   v: [-1, -1, 0, 0],       k: [.5, .5, .2, .2], label: -1, pred: -1 },
    { id: "0426", proto: "TCP", port: 8080, v: [8192, 237, 1, 1],    k: [.8, .7, .9, .6], label: 0, pred: 0,
      V: 1.1, A: [1.6, -0.9, 0.3, -0.5, -0.4] },
    { id: "0430", proto: "TCP", port: 21,   v: [26883, -1, 1, 0],    k: [.9, .9, 1, .4], label: 1, pred: 1,
      V: 1.3, A: [-0.8, 1.8, -0.6, 0.6, -0.5] },
    { id: "0433", proto: "TCP", port: 443,  v: [8192, 65535, 0, 1],  k: [.6, .7, .2, .3], label: -1, pred: -1 },
    { id: "0438", proto: "TCP", port: 80,   v: [8192, 237, 0, 1],    k: [.8, .8, .7, .9], label: 4, pred: 2,
      V: 0.9, A: [0.9, -1.0, 1.2, -0.4, 0.5] }   // a miss, as most test Web attack flows were
  ]
};
