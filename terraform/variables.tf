variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1"
}

variable "instance_type" {
  description = "EC2 instance type. t3.small (2 GB) is needed to run the app plus Prometheus, Grafana and the exporters; t3.micro's 1 GB is not enough."
  type        = string
  default     = "t3.small"
}

variable "root_volume_gb" {
  description = "Root EBS volume size. Free tier allows up to 30 GB."
  type        = number
  default     = 20
}

variable "key_name" {
  description = "Name of the existing AWS key pair"
  type        = string
  default     = "fa1-key"
}

variable "project_name" {
  description = "Used for tagging and dynamic inventory filtering"
  type        = string
  default     = "lost-and-found-fa2"
}

variable "environment" {
  description = "Environment tag"
  type        = string
  default     = "production"
}

variable "allowed_ssh_cidr" {
  description = "CIDR allowed to SSH. Restrict to your own IP where practical; CI also needs to reach port 22."
  type        = string
  default     = "0.0.0.0/0"
}

variable "allowed_ops_cidr" {
  description = "CIDR allowed to reach Grafana, Prometheus and Alertmanager. These expose operational data, so restrict them in a real deployment."
  type        = string
  default     = "0.0.0.0/0"
}
